#!/usr/bin/env node

/**
 * Upload generated PMtiles to the CicloMapa S3 bucket.
 *
 * Generation is handled by the existing scripts/generate-pmtiles.js pipeline
 * (which calls scripts/overpass-to-geojson.js per area, then tippecanoe).
 * This script only adds batch definitions (pmtiles-builds.json) and S3 upload.
 *
 * Usage:
 *   node scripts/sync-pmtiles-to-s3.js [options]
 *
 * Options:
 *   --build <ids>       Comma-separated build ids from pmtiles-builds.json (default: all)
 *   --list-builds       Print configured builds and exit
 *   --skip-geojson      Reuse existing per-area GeoJSON files when present
 *   --skip-upload       Generate locally but do not upload to S3
 *   --upload-only       Skip generation; upload existing local .pmtiles files
 *   --cleanup           Remove per-area GeoJSON files after each build
 *   --dry-run           Print actions without generating or uploading
 *   --help, -h          Show help
 *
 * Before each upload, the script compares the current S3 object with the new
 * local build (size, tile counts, zoom/bounds, GeoJSON feature totals) and
 * writes a JSON report under .pmtiles-work/reports/.
 *
 * Environment (also read from .env in project root when present):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (default: us-east-1)
 *   S3_BUCKET_NAME (default: ciclomapa)
 *   S3_PMTILES_PREFIX (default: pmtiles/)
 *   CICLOMAPA_FROM (optional, passed to overpass-to-geojson as --from)
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const AWS = require('aws-sdk');
const { PMTiles } = require('pmtiles');
const { expandAreaAliases, getExpectedGeoJSONFilename } = require('./generate-pmtiles');

const ROOT = path.join(__dirname, '..');
const GENERATE_SCRIPT = path.join(__dirname, 'generate-pmtiles.js');
const BUILDS_PATH = path.join(__dirname, 'pmtiles-builds.json');
const WORK_DIR = path.join(ROOT, '.pmtiles-work');
const REPORTS_DIR = path.join(WORK_DIR, 'reports');

class NodeFileSource {
  constructor(filePath) {
    this.filePath = filePath;
  }

  getKey() {
    return this.filePath;
  }

  async getBytes(offset, length) {
    const fh = await fsp.open(this.filePath, 'r');
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, offset);
      return {
        data: buf.subarray(0, bytesRead).buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead),
      };
    } finally {
      await fh.close();
    }
  }
}

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    buildIds: null,
    listBuilds: false,
    skipGeoJSON: false,
    skipUpload: false,
    uploadOnly: false,
    cleanup: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--build' && i + 1 < args.length) {
      config.buildIds = args[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--list-builds') {
      config.listBuilds = true;
    } else if (arg === '--skip-geojson') {
      config.skipGeoJSON = true;
    } else if (arg === '--skip-upload') {
      config.skipUpload = true;
    } else if (arg === '--upload-only') {
      config.uploadOnly = true;
    } else if (arg === '--cleanup') {
      config.cleanup = true;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1]);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return config;
}

function loadBuilds() {
  const raw = fs.readFileSync(BUILDS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.builds) || parsed.builds.length === 0) {
    throw new Error(`No builds found in ${BUILDS_PATH}`);
  }
  return parsed.builds;
}

function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET_NAME || 'ciclomapa',
    prefix: process.env.S3_PMTILES_PREFIX || 'pmtiles/',
    region: process.env.AWS_REGION || 'us-east-1',
  };
}

function getS3Client() {
  const { region } = getS3Config();
  return new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region,
    signatureVersion: 'v4',
  });
}

function s3KeyForOutput(output, prefix) {
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return `${normalizedPrefix}${output}`;
}

async function fileSize(filePath) {
  const stat = await fsp.stat(filePath);
  return stat.size;
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatBounds(header) {
  if (!header) return '—';
  return `${header.minLon.toFixed(3)}, ${header.minLat.toFixed(3)}, ${header.maxLon.toFixed(3)}, ${header.maxLat.toFixed(3)}`;
}

function formatZoom(header) {
  if (!header) return '—';
  return `${header.minZoom}–${header.maxZoom}`;
}

function formatDelta(before, after, { suffix = '', percent = false } = {}) {
  if (before == null || after == null) return '—';
  const delta = after - before;
  if (delta === 0) return 'no change';
  const sign = delta > 0 ? '+' : '';
  if (percent && before !== 0) {
    const pct = ((delta / before) * 100).toFixed(1);
    return `${sign}${delta}${suffix} (${sign}${pct}%)`;
  }
  return `${sign}${delta}${suffix}`;
}

function publicUrlForKey(key) {
  const { bucket, region } = getS3Config();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function inspectPmtilesHeader(source) {
  const pmtiles = new PMTiles(source);
  const header = await pmtiles.getHeader();
  return {
    numTileEntries: header.numTileEntries,
    numAddressedTiles: header.numAddressedTiles,
    numTileContents: header.numTileContents,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    bounds: formatBounds(header),
    center: `${header.centerLon.toFixed(3)}, ${header.centerLat.toFixed(3)} @ z${header.centerZoom}`,
  };
}

async function inspectRemoteBuild(outputFilename) {
  const { bucket, prefix } = getS3Config();
  const key = s3KeyForOutput(outputFilename, prefix);
  const url = publicUrlForKey(key);

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return { exists: false, key, url, note: 'AWS credentials not configured' };
  }

  const s3 = getS3Client();
  try {
    const head = await s3.headObject({ Bucket: bucket, Key: key }).promise();
    let header = null;
    try {
      header = await inspectPmtilesHeader(url);
    } catch (error) {
      header = { error: error.message };
    }

    return {
      exists: true,
      key,
      url,
      size: head.ContentLength,
      lastModified: head.LastModified?.toISOString() ?? null,
      etag: head.ETag,
      header,
    };
  } catch (error) {
    if (error.code === 'NotFound' || error.statusCode === 404) {
      return { exists: false, key, url };
    }
    throw error;
  }
}

async function inspectLocalBuild(localPath) {
  const exists = await fsp
    .access(localPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    return { exists: false, path: localPath };
  }

  const stat = await fsp.stat(localPath);
  let header = null;
  try {
    header = await inspectPmtilesHeader(new NodeFileSource(localPath));
  } catch (error) {
    header = { error: error.message };
  }

  return {
    exists: true,
    path: localPath,
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    header,
  };
}

async function countGeoJsonFeaturesForBuild(build) {
  const expectedFiles = new Set(
    expandAreaAliases(build.areas).map((area) => getExpectedGeoJSONFilename(area))
  );
  let totalFeatures = 0;
  const files = [];

  for (const filename of expectedFiles) {
    const filePath = path.join(WORK_DIR, filename);
    const exists = await fsp
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) continue;

    const geojson = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    const features = Array.isArray(geojson.features) ? geojson.features.length : 0;
    totalFeatures += features;
    files.push({ file: filename, features });
  }

  return { totalFeatures, files };
}

function formatTimestamp(value) {
  if (!value) return '—';
  return String(value)
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

function printChangeReport(build, before, after, geojsonStats) {
  console.log('');
  console.log(`📊 Change report: ${build.output}`);
  console.log('─'.repeat(78));

  const rows = [
    ['Status', before.exists ? 'on S3' : 'not on S3', after.exists ? 'local build' : 'missing'],
    ['Size', formatBytes(before.size), formatBytes(after.size)],
    [
      'Size delta',
      '—',
      before.exists && after.exists ? formatDelta(before.size, after.size, { percent: true }) : '—',
    ],
    ['Last modified', formatTimestamp(before.lastModified), formatTimestamp(after.lastModified)],
    ['Tile entries', before.header?.numTileEntries ?? '—', after.header?.numTileEntries ?? '—'],
    [
      'Tile entries delta',
      '—',
      before.header?.numTileEntries != null && after.header?.numTileEntries != null
        ? formatDelta(before.header.numTileEntries, after.header.numTileEntries)
        : '—',
    ],
    [
      'Addressed tiles',
      before.header?.numAddressedTiles ?? '—',
      after.header?.numAddressedTiles ?? '—',
    ],
    ['Zoom range', formatZoom(before.header), formatZoom(after.header)],
    [
      'Bounds (W,S,E,N)',
      before.header?.bounds ?? '—',
      before.header?.bounds && after.header?.bounds && before.header.bounds === after.header.bounds
        ? 'no change'
        : (after.header?.bounds ?? '—'),
    ],
    [
      'GeoJSON features',
      '—',
      geojsonStats?.totalFeatures != null ? String(geojsonStats.totalFeatures) : '—',
    ],
  ];

  const col1 = 20;
  const col2 = 28;
  console.log(`${''.padEnd(col1)}${'Before (S3)'.padEnd(col2)}After (new)`);
  for (const [label, left, right] of rows) {
    console.log(`${label.padEnd(col1)}${String(left).padEnd(col2)}${right}`);
  }

  if (geojsonStats?.files?.length) {
    console.log('');
    console.log('   GeoJSON inputs:');
    for (const { file, features } of geojsonStats.files) {
      console.log(`   - ${file}: ${features.toLocaleString()} features`);
    }
  }

  if (before.header?.error) {
    console.log(`   ⚠️  Could not read remote PMtiles header: ${before.header.error}`);
  }
  if (after.header?.error) {
    console.log(`   ⚠️  Could not read local PMtiles header: ${after.header.error}`);
  }

  console.log('─'.repeat(78));
}

async function writeChangeReport(build, before, after, geojsonStats) {
  await fsp.mkdir(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `${build.id}-${stamp}.json`);
  const payload = {
    buildId: build.id,
    output: build.output,
    areas: build.areas,
    generatedAt: new Date().toISOString(),
    before,
    after,
    geojson: geojsonStats,
    deltas: {
      sizeBytes: before.size != null && after.size != null ? after.size - before.size : null,
      tileEntries:
        before.header?.numTileEntries != null && after.header?.numTileEntries != null
          ? after.header.numTileEntries - before.header.numTileEntries
          : null,
      addressedTiles:
        before.header?.numAddressedTiles != null && after.header?.numAddressedTiles != null
          ? after.header.numAddressedTiles - before.header.numAddressedTiles
          : null,
    },
  };
  await fsp.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`   Report saved: ${reportPath}`);
  return reportPath;
}

async function uploadToS3(localPath, outputFilename, { dryRun }) {
  const { bucket, prefix } = getS3Config();
  const key = s3KeyForOutput(outputFilename, prefix);
  const exists = await fsp
    .access(localPath)
    .then(() => true)
    .catch(() => false);
  const size = exists ? await fileSize(localPath) : 0;

  if (dryRun) {
    const sizeLabel = exists ? formatBytes(size) : 'file not generated yet';
    console.log(`   [dry-run] Would upload ${localPath} → s3://${bucket}/${key} (${sizeLabel})`);
    return { bucket, key, size };
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      'Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env or the environment.'
    );
  }

  const s3 = getS3Client();
  console.log(`   Uploading ${formatBytes(size)} → s3://${bucket}/${key}`);

  await s3
    .upload({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(localPath),
      ACL: 'public-read',
      ContentType: 'application/vnd.pmtiles',
      CacheControl: 'public, max-age=3600',
    })
    .promise();

  const publicUrl = `https://${bucket}.s3.${getS3Config().region}.amazonaws.com/${key}`;
  console.log(`   ✓ Uploaded: ${publicUrl}`);
  return { bucket, key, size, url: publicUrl };
}

async function runGeneratePMtiles(build, localOutputPath, options) {
  const args = ['--output', localOutputPath, '--areas', build.areas.join(',')];
  if (options.skipGeoJSON) args.push('--skip-geojson');
  if (options.cleanup) args.push('--cleanup');
  if (build.includePoi) args.push('--include-poi');

  await fsp.mkdir(WORK_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    console.log(`   Running: node scripts/generate-pmtiles.js ${args.join(' ')}`);

    const child = spawn('node', [GENERATE_SCRIPT, ...args], {
      stdio: 'inherit',
      cwd: WORK_DIR,
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`generate-pmtiles.js exited with code ${code} for build: ${build.id}`));
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn generate-pmtiles.js: ${error.message}`));
    });
  });
}

async function ensureWorkDir() {
  await fsp.mkdir(WORK_DIR, { recursive: true });
}

async function buildOne(build, options) {
  const localOutputPath = path.join(WORK_DIR, build.output);

  console.log('');
  console.log(`▶ Build: ${build.id}`);
  console.log(`  ${build.description || build.areas.join(', ')}`);
  console.log(`  Output: ${build.output}`);

  const before = await inspectRemoteBuild(build.output);

  if (!options.uploadOnly) {
    if (options.dryRun) {
      console.log(
        `   [dry-run] Would generate ${build.output} from areas: ${build.areas.join(', ')}`
      );
    } else {
      await runGeneratePMtiles(build, localOutputPath, options);
    }
  }

  const after = options.dryRun
    ? await inspectLocalBuild(localOutputPath).catch(() => ({ exists: false }))
    : await inspectLocalBuild(localOutputPath);

  const geojsonStats =
    options.dryRun || options.uploadOnly
      ? null
      : await countGeoJsonFeaturesForBuild(build).catch(() => null);

  if (!options.dryRun) {
    printChangeReport(build, before, after, geojsonStats);
    await writeChangeReport(build, before, after, geojsonStats);
  } else if (before.exists || after.exists) {
    printChangeReport(build, before, after, geojsonStats);
  }

  if (options.skipUpload) {
    console.log('   Skipping upload (--skip-upload)');
    return { build: build.id, before, after, geojsonStats };
  }

  if (options.dryRun) {
    return uploadToS3(localOutputPath, build.output, { dryRun: true });
  }

  if (!after.exists) {
    throw new Error(`Expected output not found: ${localOutputPath}`);
  }

  return uploadToS3(localOutputPath, build.output, { dryRun: false });
}

async function main() {
  loadDotEnv();
  const options = parseArgs();
  const builds = loadBuilds();

  if (options.listBuilds) {
    console.log('Configured PMtiles builds:\n');
    for (const build of builds) {
      console.log(`  ${build.id}`);
      console.log(`    output: ${build.output}`);
      console.log(`    areas:  ${build.areas.join(', ')}`);
      if (build.includePoi) console.log(`    POIs:   included`);
      if (build.description) console.log(`    note:   ${build.description}`);
      console.log('');
    }
    return;
  }

  let selected = builds;
  if (options.buildIds) {
    const known = new Set(builds.map((b) => b.id));
    const unknown = options.buildIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown build id(s): ${unknown.join(', ')}. Use --list-builds to see options.`
      );
    }
    selected = builds.filter((b) => options.buildIds.includes(b.id));
  }

  await ensureWorkDir();

  console.log('');
  console.log('🚀 CicloMapa PMtiles → S3');
  console.log('─'.repeat(60));
  console.log(`   Builds: ${selected.map((b) => b.id).join(', ')}`);
  console.log(`   Work dir: ${WORK_DIR}`);
  console.log(`   S3 bucket: ${getS3Config().bucket}`);
  console.log(`   S3 prefix: ${getS3Config().prefix}`);
  console.log(`   Upload: ${options.skipUpload ? 'NO' : 'YES'}`);
  console.log(
    `   Mode: ${options.uploadOnly ? 'upload-only' : options.dryRun ? 'dry-run' : 'generate+upload'}`
  );
  console.log('─'.repeat(60));

  const results = [];
  for (const build of selected) {
    results.push(await buildOne(build, options));
  }

  console.log('');
  console.log('✨ Done');
  if (!options.skipUpload && !options.dryRun) {
    for (const result of results) {
      if (result?.url) console.log(`   ${result.url}`);
    }
  }
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  });
}

module.exports = { main, loadBuilds, uploadToS3 };
