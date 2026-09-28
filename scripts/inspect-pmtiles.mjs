#!/usr/bin/env node
/**
 * Dev helper: print a PMTiles archive header and sample the features of one tile,
 * to check which layers/properties actually made it into a build.
 *
 * Usage:
 *   node scripts/inspect-pmtiles.mjs [filename|url] [lng lat zoom]
 *
 * Defaults to brazil-poi.pmtiles on the CicloMapa S3 bucket, sampled over Fortaleza.
 */
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const S3_BASE = 'https://ciclomapa.s3.us-east-1.amazonaws.com/pmtiles/';
const [fileArg = 'brazil-poi.pmtiles', lngArg, latArg, zoomArg] = process.argv.slice(2);
const url = /^https?:\/\//.test(fileArg) ? fileArg : S3_BASE + fileArg;

// Fortaleza, Brazil (DEFAULT_AREA) ~ -3.7327, -38.5267
const lng = lngArg != null ? Number(lngArg) : -38.5267;
const lat = latArg != null ? Number(latArg) : -3.7327;
const zoom = zoomArg != null ? Number(zoomArg) : 11;

const p = new PMTiles(url);

const header = await p.getHeader();
console.log('url:', url);
console.log('header:', JSON.stringify(header, null, 2));

const metadata = await p.getMetadata();
console.log('description:', metadata.description);
for (const layer of metadata.vector_layers || []) {
  console.log(`\nvector layer "${layer.id}" fields:`, Object.keys(layer.fields || {}).join(', '));
}

function lngLatToTile(lng, lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

const { x, y, z } = lngLatToTile(lng, lat, Math.min(zoom, header.maxZoom));
console.log(`\nFetching tile z=${z} x=${x} y=${y}`);

const tileResult = await p.getZxy(z, x, y);
if (!tileResult) {
  console.log('No tile data found at this location/zoom.');
  process.exit(0);
}

const tile = new VectorTile(new PbfReader(tileResult.data));
console.log('Layers in tile:', Object.keys(tile.layers));

for (const layerName of Object.keys(tile.layers)) {
  const layer = tile.layers[layerName];
  console.log(`\nLayer "${layerName}" - ${layer.length} features`);
  const sample = Math.min(layer.length, 5);
  for (let i = 0; i < sample; i++) {
    const feat = layer.feature(i);
    console.log(`  feature[${i}] type=${feat.type} properties=`, feat.properties);
  }
}
