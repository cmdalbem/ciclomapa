import { PMTiles, FetchSource } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';

const url = 'https://ciclomapa.s3.us-east-1.amazonaws.com/pmtiles/brazil-poi.pmtiles';
const p = new PMTiles(url);

const header = await p.getHeader();
console.log('header:', JSON.stringify(header, null, 2));

// Fortaleza, Brazil (DEFAULT_AREA) ~ -3.7327, -38.5267
function lngLatToTile(lng, lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

const zoom = 11;
const { x, y, z } = lngLatToTile(-38.5267, -3.7327, zoom);
console.log(`Fetching tile z=${z} x=${x} y=${y}`);

const tileResult = await p.getZxy(z, x, y);
if (!tileResult) {
  console.log('No tile data found at this location/zoom.');
  process.exit(0);
}

const tile = new VectorTile(new Protobuf(tileResult.data));
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
