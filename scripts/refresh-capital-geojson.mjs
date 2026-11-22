#!/usr/bin/env node
/**
 * Refresh stored GeoJSON (Firestore) for Brazilian capitals.
 *
 * Usage:
 *   node scripts/refresh-capital-geojson.mjs
 *   node scripts/refresh-capital-geojson.mjs --collection cities-dev
 *   node scripts/refresh-capital-geojson.mjs --lengths-only
 *
 * Default writes to both `cities` and `cities-dev`.
 * `--lengths-only` skips Overpass: recalculates from /tmp GeoJSON or Firestore.
 * Progress: stdout + /tmp/ciclomapa-refresh-capitals.log
 */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

globalThis.window = globalThis.window || {
  location: { hostname: '' },
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
};

const firebase = require('firebase/app');
require('firebase/firestore');
const { stringify, parse: parseZipson } = require('zipson');

const { cleanUpInternalTags, calculateLayersLengths } =
  await import('../src/utils/geojsonUtils.js');
const LAYERS_CATALOG_VERSION = 'v2';
const layersDefinitions = JSON.parse(
  fs.readFileSync(path.join(ROOT, `src/config/layers.${LAYERS_CATALOG_VERSION}.json`), 'utf8')
);

const OUT_DIR = '/tmp/ciclomapa-capitals-geojson';
const LOG_PATH = '/tmp/ciclomapa-refresh-capitals.log';
const STATUS_PATH = '/tmp/ciclomapa-refresh-capitals-status.json';
const LENGTHS_LOG_PATH = '/tmp/ciclomapa-recalc-lengths.log';
const LENGTHS_STATUS_PATH = '/tmp/ciclomapa-recalc-lengths-status.json';

const CAPITALS = [
  'Aracaju, Sergipe, Brasil',
  'Belém, Pará, Brasil',
  'Belo Horizonte, Minas Gerais, Brasil',
  'Boa Vista, Roraima, Brasil',
  'Brasília, Distrito Federal, Brasil',
  'Campo Grande, Mato Grosso do Sul, Brasil',
  'Cuiabá, Mato Grosso, Brasil',
  'Curitiba, Paraná, Brasil',
  'Florianópolis, Santa Catarina, Brasil',
  'Fortaleza, Ceará, Brasil',
  'Goiânia, Goiás, Brasil',
  'João Pessoa, Paraíba, Brasil',
  'Macapá, Amapá, Brasil',
  'Maceió, Alagoas, Brasil',
  'Manaus, Amazonas, Brasil',
  'Natal, Rio Grande do Norte, Brasil',
  'Palmas, Tocantins, Brasil',
  'Porto Alegre, Rio Grande do Sul, Brasil',
  'Porto Velho, Rondônia, Brasil',
  'Recife, Pernambuco, Brasil',
  'Rio Branco, Acre, Brasil',
  'Rio de Janeiro, Rio de Janeiro, Brasil',
  'São Luís, Maranhão, Brasil',
  'Salvador, Bahia, Brasil',
  'São Paulo, São Paulo, Brasil',
  'Teresina, Piauí, Brasil',
  'Vitória, Espírito Santo, Brasil',
];

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDUbMY3UuyJ9vVVBblhUR9L1B3TV6a3eRU',
  authDomain: 'ciclomapa-app.firebaseapp.com',
  projectId: 'ciclomapa-app',
};

const MAX_DOCUMENT_SIZE = 800 * 1024;
const ESTIMATED_OVERHEAD = 1000;

function slugify(str) {
  const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·/_,:;';
  const b = 'aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz------';
  const p = new RegExp(a.split('').join('|'), 'g');
  return str
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(p, (c) => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const collections = [];
  let lengthsOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--collection' && args[i + 1]) collections.push(args[++i]);
    else if (args[i] === '--lengths-only') lengthsOnly = true;
  }
  return {
    collections: collections.length ? collections : ['cities', 'cities-dev'],
    lengthsOnly,
  };
}

let activeLogPath = LOG_PATH;
let activeStatusPath = STATUS_PATH;

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  fs.appendFileSync(activeLogPath, stamped + '\n');
}

function writeStatus(status) {
  fs.writeFileSync(activeStatusPath, JSON.stringify(status, null, 2));
}

function assertGeoJsonCatalogVersion(geoJson, label) {
  const version = geoJson?.ciclomapa?.layersVersion;
  if (version !== LAYERS_CATALOG_VERSION) {
    throw new Error(
      `${label} is ${version ? `catalog ${version}` : 'missing a catalog stamp'}; this recalc uses ${LAYERS_CATALOG_VERSION}. Re-run Overpass.`
    );
  }
}

const OVERPASS_AREA_ALIASES = {
  'Vitória, Espírito Santo, Brasil': 'Vitória, Espirito Santo, Brasil',
};

function runOverpass(area, outputPath) {
  const overpassArea = OVERPASS_AREA_ALIASES[area] || area;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(ROOT, 'scripts/overpass-to-geojson.js'),
        '--area',
        overpassArea,
        '--include-poi',
        '--output',
        outputPath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          CICLOMAPA_FROM: process.env.CICLOMAPA_FROM || 'contato@ciclomapa.org.br',
        },
      }
    );
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d;
      process.stderr.write(d);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`overpass-to-geojson exited ${code} for ${area}`));
    });
  });
}

function compressJson(geoJson) {
  const data = JSON.parse(JSON.stringify(geoJson));
  cleanUpInternalTags(data);
  return stringify(data, { fullPrecisionFloats: true });
}

function chunkString(data) {
  const maxBytes = MAX_DOCUMENT_SIZE - ESTIMATED_OVERHEAD;
  const buf = Buffer.from(data, 'utf8');
  const chunks = [];
  let offset = 0;
  while (offset < buf.length) {
    let end = Math.min(offset + maxBytes, buf.length);
    if (end < buf.length) {
      while (end > offset && (buf[end] & 0xc0) === 0x80) end--;
    }
    chunks.push(buf.subarray(offset, end).toString('utf8'));
    offset = end;
  }
  return chunks;
}

async function saveCity(db, collection, name, geoJson, lengths) {
  const slug = slugify(name);
  const compressed = compressJson(geoJson);
  const chunks = chunkString(compressed);

  await db.collection(collection).doc(`${slug}_metadata`).set({
    name,
    totalChunks: chunks.length,
    totalSize: compressed.length,
    lengths,
    updatedAt: new Date(),
    format: 'chunked_v1',
  });

  await Promise.all(
    chunks.map((chunk, index) =>
      db
        .collection(collection)
        .doc(`${slug}_chunk_${index + 1}`)
        .set({
          data: chunk,
          chunkNumber: index + 1,
          totalChunks: chunks.length,
        })
    )
  );

  if (Object.keys(lengths).length > 0) {
    await db.collection('stats').doc(slug).set({ lengths });
  }

  return { slug, chunks: chunks.length, bytes: compressed.length };
}

async function loadGeoJsonFromFirestore(db, collection, name) {
  const slug = slugify(name);
  const metaSnap = await db.collection(collection).doc(`${slug}_metadata`).get();
  if (!metaSnap.exists) return null;
  const metadata = metaSnap.data();
  const totalChunks = metadata.totalChunks || 0;
  if (!totalChunks) return null;
  const parts = [];
  for (let i = 1; i <= totalChunks; i++) {
    const chunkSnap = await db.collection(collection).doc(`${slug}_chunk_${i}`).get();
    if (!chunkSnap.exists) throw new Error(`missing chunk ${i} for ${slug}`);
    parts.push(chunkSnap.data().data);
  }
  const compressed = parts.join('');
  try {
    return parseZipson(compressed);
  } catch {
    return JSON.parse(compressed);
  }
}

async function saveLengthsOnly(db, collections, name, lengths) {
  const slug = slugify(name);
  for (const collection of collections) {
    await db.collection(collection).doc(`${slug}_metadata`).set({ lengths }, { merge: true });
  }
  if (Object.keys(lengths).length > 0) {
    await db.collection('stats').doc(slug).set({ lengths }, { merge: true });
  }
  return slug;
}

async function main() {
  const { collections, lengthsOnly } = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (lengthsOnly) {
    activeLogPath = LENGTHS_LOG_PATH;
    activeStatusPath = LENGTHS_STATUS_PATH;
    fs.writeFileSync(LENGTHS_LOG_PATH, '');
  } else {
    fs.writeFileSync(LOG_PATH, '');
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  const db = firebase.firestore();

  const layers = layersDefinitions
    .filter((l) => !l.onlyDebug)
    .map((l) => ({
      ...l,
      id: slugify(l.name),
      type: l.type || 'way',
    }));
  const status = {
    startedAt: new Date().toISOString(),
    collections,
    total: CAPITALS.length,
    done: 0,
    ok: [],
    failed: [],
    current: null,
  };
  writeStatus(status);
  log(
    lengthsOnly
      ? `Recalculating lengths for ${CAPITALS.length} capitals (no Overpass)`
      : `Refreshing ${CAPITALS.length} capitals into ${collections.join(', ')}`
  );

  const results = [];

  for (let i = 0; i < CAPITALS.length; i++) {
    const area = CAPITALS[i];
    const n = `${i + 1}/${CAPITALS.length}`;
    status.current = area;
    writeStatus(status);
    log(`[${n}] START ${area}`);
    const file = path.join(OUT_DIR, `${slugify(area)}.geojson`);
    try {
      let geoJson;
      let source = 'overpass';
      if (lengthsOnly) {
        if (fs.existsSync(file)) {
          geoJson = JSON.parse(fs.readFileSync(file, 'utf8'));
          source = 'local';
          assertGeoJsonCatalogVersion(geoJson, path.basename(file));
        } else {
          geoJson = await loadGeoJsonFromFirestore(db, collections[0], area);
          source = 'firestore';
          if (!geoJson) throw new Error(`no local GeoJSON and nothing in ${collections[0]}`);
        }
      } else {
        await runOverpass(area, file);
        geoJson = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      const geoJsonForLengths = JSON.parse(JSON.stringify(geoJson));
      const lengths = calculateLayersLengths(
        geoJsonForLengths,
        layers,
        'pessimistic',
        'geometry_first'
      );
      const cicloviaKm = Number(lengths.ciclovia || 0).toFixed(1);
      const ciclofaixaKm = Number(lengths.ciclofaixa || 0).toFixed(1);
      log(
        `[${n}] ${source} ${geoJson.features.length} features; lengths ciclovia=${cicloviaKm} ciclofaixa=${ciclofaixaKm}`
      );

      if (lengthsOnly) {
        // Don't rewrite GeoJSON for cities the Overpass job hasn't finished;
        // those would get overwritten with old pairing lengths.
        if (source === 'local') {
          const slug = await saveLengthsOnly(db, collections, area, lengths);
          log(`[${n}] saved lengths ${slug}`);
        } else {
          log(`[${n}] skip Firestore write (no local file; Overpass job may still overwrite)`);
        }
      } else {
        for (const collection of collections) {
          const saved = await saveCity(db, collection, area, geoJson, lengths);
          log(
            `[${n}] saved ${collection}/${saved.slug} (${saved.chunks} chunks, ${saved.bytes} bytes)`
          );
        }
      }

      results.push({
        area,
        source,
        features: geoJson.features.length,
        ciclovia: Number(lengths.ciclovia || 0),
        ciclofaixa: Number(lengths.ciclofaixa || 0),
        total: Number(lengths.ciclovia || 0) + Number(lengths.ciclofaixa || 0),
      });
      status.ok.push(area);
      status.done = i + 1;
      status.current = null;
      writeStatus(status);
      log(`[${n}] OK ${area}`);
    } catch (err) {
      status.failed.push({ area, error: String(err.message || err) });
      status.done = i + 1;
      status.current = null;
      writeStatus(status);
      log(`[${n}] FAIL ${area}: ${err.message || err}`);
    }

    if (!lengthsOnly && i < CAPITALS.length - 1) {
      await new Promise((r) => setTimeout(r, 8000));
    }
  }

  if (lengthsOnly) {
    const resultsPath = '/tmp/ciclomapa-capital-lengths.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    log(`wrote ${resultsPath}`);
  }

  status.finishedAt = new Date().toISOString();
  writeStatus(status);
  log(`DONE ok=${status.ok.length} failed=${status.failed.length}`);
  if (status.failed.length) process.exitCode = 1;
}

main().catch((err) => {
  log(`FATAL ${err.stack || err}`);
  process.exit(1);
});
