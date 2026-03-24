import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, 'src/config/citySlugCatalog.js');
const OUTPUT_PATH = path.join(ROOT, 'scripts/city-slug-static-data.generated.json');

function extractCatalogObjectLiteral(source) {
  const marker = 'const PREDEFINED_CITY_CATALOG = ';
  const start = source.indexOf(marker);
  if (start === -1) throw new Error('Could not find PREDEFINED_CITY_CATALOG declaration');
  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) throw new Error('Could not find catalog opening brace');

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inTemplate && ch === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === '`') inTemplate = !inTemplate;
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(openBrace, i + 1);
    }
  }
  throw new Error('Could not extract catalog object literal');
}

function parseCatalog(source) {
  const literal = extractCatalogObjectLiteral(source);
  return vm.runInNewContext(`(${literal})`);
}

function normalizeAreaFromResult(result) {
  const address = result?.address || {};
  const city =
    address.city || address.municipality || address.town || address.village || address.county || '';
  const state = address.state || address.state_district || '';
  const country = address.country || '';
  const parts = [city, state, country].map((p) => String(p || '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(', ');

  const display = String(result?.display_name || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return display.slice(0, 3).join(', ');
}

function parseBounds(result) {
  const bb = result?.boundingbox;
  if (!Array.isArray(bb) || bb.length !== 4) return null;
  const south = Number(bb[0]);
  const north = Number(bb[1]);
  const west = Number(bb[2]);
  const east = Number(bb[3]);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [west, south, east, north];
}

async function searchNominatim(query, { countrycodes }) {
  const strict = new URL('https://nominatim.openstreetmap.org/search');
  strict.searchParams.set('format', 'json');
  strict.searchParams.set('q', query);
  strict.searchParams.set('limit', '5');
  strict.searchParams.set('addressdetails', '1');
  strict.searchParams.set('featureType', 'city');
  strict.searchParams.set('accept-language', 'pt-BR,pt,en');
  strict.searchParams.set('layer', 'address');
  if (countrycodes?.length) strict.searchParams.set('countrycodes', countrycodes.join(','));

  const compatibility = new URL(strict.toString());
  compatibility.searchParams.set('featureType', 'settlement');

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'CicloMapaSlugDataBot/1.0 (https://ciclomapa.app)',
  };

  const strictResp = await fetch(strict, { headers });
  if (!strictResp.ok) throw new Error(`Strict request failed: ${strictResp.status}`);
  let data = await strictResp.json();
  if (Array.isArray(data) && data.length > 0) return data;

  const compatResp = await fetch(compatibility, { headers });
  if (!compatResp.ok) throw new Error(`Compatibility request failed: ${compatResp.status}`);
  data = await compatResp.json();
  return Array.isArray(data) ? data : [];
}

async function main() {
  const source = await fs.readFile(CATALOG_PATH, 'utf8');
  const catalog = parseCatalog(source);
  const entries = Object.entries(catalog);
  const result = {};

  for (let i = 0; i < entries.length; i += 1) {
    const [slug, definition] = entries[i];
    const query = definition?.query || String(slug).replace(/[-_]+/g, ' ').trim();
    const countrycodes = Array.isArray(definition?.countrycodes)
      ? definition.countrycodes
      : undefined;
    process.stdout.write(`[${i + 1}/${entries.length}] ${slug} -> ${query}\n`);

    const data = await searchNominatim(query, { countrycodes });
    if (!data.length) {
      throw new Error(`No Nominatim result for slug "${slug}" (${query})`);
    }

    const best = data[0];
    const lat = Number(best.lat);
    const lng = Number(best.lon);
    const bbox = parseBounds(best);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !bbox) {
      throw new Error(`Invalid geodata for slug "${slug}"`);
    }

    result[slug] = {
      areaLabel: normalizeAreaFromResult(best),
      lat,
      lng,
      bbox,
    };

    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  process.stdout.write(`\nGenerated ${OUTPUT_PATH}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
