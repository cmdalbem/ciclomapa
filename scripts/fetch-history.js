#!/usr/bin/env node

/**
 * Fetch Historical OSM Snapshots
 * 
 * Fetches cycling infrastructure data from Overpass API for multiple dates.
 * Queries each layer separately to stay within Overpass memory limits,
 * then merges results into a single GeoJSON per date.
 * 
 * Usage:
 *   node scripts/fetch-history.js [options]
 */

const fs = require('fs');
const path = require('path');
const {
    executeOverpassQuery,
    convertToGeoJSON,
    slugify,
    Spinner,
    OVERPASS_SERVERS,
} = require('./overpass-to-geojson');

const BBOXES = {
    'brazil': '-33.75,-73.99,5.27,-34.79',
    'fortaleza': '-3.88,-38.66,-3.69,-38.40',
    'sao paulo': '-24.01,-46.83,-23.35,-46.36',
    'brasilia': '-16.05,-48.29,-15.50,-47.31',
    'brasília': '-16.05,-48.29,-15.50,-47.31',
    'rio de janeiro': '-23.08,-43.80,-22.74,-43.09',
};

// Filters that start with broad base tags cause OOM on historical queries.
// highway=footway/pedestrian match hundreds of thousands of elements in any city.
const BROAD_BASE_TAGS = new Set(['highway=footway', 'highway=pedestrian', 'highway=living_street', 'highway=track', 'highway=path']);

// Layers with only broad-tag filters or that match too many non-cycling elements.
const ALWAYS_EXCLUDED = new Set(['proibido', 'baixa velocidade', 'trilha']);

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        area: 'Brazil',
        startYear: 2016,
        endYear: 2025,
        intervalMonths: 12,
        outputDir: path.join(__dirname, '..', 'public', 'history'),
        concurrency: OVERPASS_SERVERS.length,
        bbox: null,
        includePoi: true,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--area' && i + 1 < args.length) config.area = args[++i];
        else if (arg === '--start-year' && i + 1 < args.length) config.startYear = parseInt(args[++i], 10);
        else if (arg === '--end-year' && i + 1 < args.length) config.endYear = parseInt(args[++i], 10);
        else if (arg === '--interval-months' && i + 1 < args.length) config.intervalMonths = parseInt(args[++i], 10);
        else if (arg === '--output-dir' && i + 1 < args.length) config.outputDir = args[++i];
        else if (arg === '--concurrency' && i + 1 < args.length) config.concurrency = parseInt(args[++i], 10);
        else if (arg === '--bbox' && i + 1 < args.length) config.bbox = args[++i];
        else if (arg === '--exclude-poi') config.includePoi = false;
        else if (arg === '--help' || arg === '-h') {
            console.log(`
Fetch Historical OSM Snapshots

Usage:
  node scripts/fetch-history.js [options]

Options:
  --area <name>            Area name (default: "Brazil")
  --start-year <year>      Start year (default: 2016)
  --end-year <year>        End year (default: 2025)
  --interval-months <n>    Months between snapshots (default: 12)
  --output-dir <dir>       Output directory (default: public/history)
  --concurrency <n>        Max parallel requests (default: ${OVERPASS_SERVERS.length})
  --bbox <s,w,n,e>         Bounding box override (auto-resolved otherwise)
  --exclude-poi            Exclude POI layers (bike shops, rentals, parking)
  --help, -h               Show this help message

Examples:
  node scripts/fetch-history.js --area "Fortaleza" --start-year 2020
  node scripts/fetch-history.js --area "Brazil"
  node scripts/fetch-history.js --interval-months 6
            `);
            process.exit(0);
        }
    }
    return config;
}

function generateDates(startYear, endYear, intervalMonths) {
    const dates = [];
    let current = new Date(Date.UTC(startYear, 0, 1));
    const end = new Date(Date.UTC(endYear, 0, 1));
    while (current <= end) {
        dates.push(current.toISOString().replace('.000Z', 'Z'));
        current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + intervalMonths, 1));
    }
    return dates;
}

function getOutputFilename(areaSlug, dateStr) {
    const d = new Date(dateStr);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${areaSlug}-${year}-${month}.geojson`;
}

function getHistoryLayers(includePoi) {
    const layersPath = path.join(__dirname, '..', 'src', 'layers.json');
    const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));

    return layers.filter(l => {
        if (!l.filters) return false;
        if (l.onlyDebug) return false;
        if (ALWAYS_EXCLUDED.has(l.name.toLowerCase())) return false;
        if (!includePoi && l.type === 'poi') return false;
        return true;
    });
}

function isFilterSafe(filter) {
    const firstTag = typeof filter[0] === 'string'
        ? `${filter[0]}=${filter[1]}`
        : `${filter[0][0]}=${filter[0][1]}`;
    return !BROAD_BASE_TAGS.has(firstTag);
}

function buildLayerQuery(layer, bbox, date) {
    const dateClause = `[date:"${date}"]`;
    const safeFilters = layer.filters.filter(isFilterSafe);

    if (safeFilters.length === 0) return null;

    const elementTypes = layer.type === 'poi' ? ['node', 'way'] : ['way'];
    const filterLines = [];

    for (const et of elementTypes) {
        for (const f of safeFilters) {
            const tags = typeof f[0] === 'string'
                ? `["${f[0]}"="${f[1]}"]`
                : f.map(inner => `["${inner[0]}"="${inner[1]}"]`).join('');
            filterLines.push(`${et}${tags}(${bbox});`);
        }
    }

    return `[out:json][timeout:500]${dateClause};\n(\n${filterLines.join('\n')}\n);\nout body geom;`;
}

// Servers known to work with historical queries. overpass.osm.jp excluded (TLS cert issues).
const HISTORY_SERVERS = OVERPASS_SERVERS.filter(s => !s.includes('osm.jp'));

async function executeQuery(query, server) {
    const postBody = `data=${encodeURIComponent(query)}`;
    return executeOverpassQuery(postBody, server);
}

async function executeQueryWithRetry(query, preferredServer, label, layerName) {
    const servers = [preferredServer, ...HISTORY_SERVERS.filter(s => s !== preferredServer)];
    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        try {
            const startTime = Date.now();
            if (i > 0) {
                console.log(`  [${label}] Retrying "${layerName}" on ${new URL(server).hostname}...`);
            }
            const osmData = await executeQuery(query, server);
            const secs = ((Date.now() - startTime) / 1000).toFixed(1);
            const count = osmData.elements ? osmData.elements.length : 0;

            if (osmData.remark && osmData.remark.includes('out of memory')) {
                console.warn(`  [${label}] ⚠️ "${layerName}" OOM on ${new URL(server).hostname}`);
                return null;
            }

            console.log(`  [${label}] "${layerName}": ${count} elements in ${secs}s`);
            return osmData;
        } catch (error) {
            const shortErr = error.message.substring(0, 80);
            if (i < servers.length - 1) {
                console.warn(`  [${label}] "${layerName}" failed on ${new URL(server).hostname}: ${shortErr}`);
            } else {
                console.warn(`  [${label}] ⚠️ "${layerName}" failed on all servers: ${shortErr}`);
                return null;
            }
        }
    }
    return null;
}

function mergeOsmResponses(responses) {
    const seenIds = new Set();
    const elements = [];
    for (const resp of responses) {
        if (!resp || !resp.elements) continue;
        for (const el of resp.elements) {
            const key = `${el.type}/${el.id}`;
            if (!seenIds.has(key)) {
                seenIds.add(key);
                elements.push(el);
            }
        }
    }
    return { elements };
}

async function fetchSnapshot({ date, bbox, outputPath, layers, concurrency }) {
    const filename = path.basename(outputPath);
    const d = new Date(date);
    const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    // Build per-layer queries
    const layerTasks = [];
    for (const layer of layers) {
        const query = buildLayerQuery(layer, bbox, date);
        if (!query) {
            console.log(`  [${label}] Skipping "${layer.name}" (all filters use broad tags)`);
            continue;
        }
        layerTasks.push({ layer, query });
    }

    // Execute layer queries with retry across servers
    const responses = [];
    let serverIdx = 0;

    for (const task of layerTasks) {
        const server = HISTORY_SERVERS[serverIdx % HISTORY_SERVERS.length];
        serverIdx++;

        console.log(`  [${label}] Fetching "${task.layer.name}" from ${new URL(server).hostname}...`);
        const promise = executeQueryWithRetry(task.query, server, label, task.layer.name);
        responses.push(promise);
    }

    // Wait for all layer queries to complete (they run sequentially per date
    // to avoid overwhelming servers, but retry logic handles failures)

    const resolved = await Promise.all(responses);
    const validResponses = resolved.filter(Boolean);

    const merged = mergeOsmResponses(validResponses);
    console.log(`  [${label}] Total: ${merged.elements.length} elements, converting to GeoJSON...`);

    const geoJson = convertToGeoJSON(merged);
    const jsonString = JSON.stringify(geoJson);
    await fs.promises.writeFile(outputPath, jsonString, 'utf8');

    const sizeMB = (Buffer.byteLength(jsonString) / (1024 * 1024)).toFixed(1);
    console.log(`  [${label}] ✓ Saved ${filename} (${geoJson.features.length} features, ${sizeMB} MB)`);

    return { date, file: filename, features: geoJson.features.length };
}

async function resolveBbox(area, explicitBbox) {
    if (explicitBbox) return explicitBbox;

    const areaLower = area.toLowerCase();
    for (const [key, value] of Object.entries(BBOXES)) {
        if (areaLower.includes(key)) {
            console.log(`✓ Using known bbox for "${key}": ${value}`);
            return value;
        }
    }

    const spinner = new Spinner('Resolving area bbox via Nominatim...');
    spinner.start();
    try {
        const https = require('https');
        const bbox = await new Promise((resolve, reject) => {
            const encoded = encodeURIComponent(area);
            https.get(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&featuretype=city`, {
                headers: { 'User-Agent': 'CicloMapa History Fetcher' }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    const results = JSON.parse(data);
                    if (results.length > 0 && results[0].boundingbox) {
                        const bb = results[0].boundingbox;
                        resolve(`${bb[0]},${bb[2]},${bb[1]},${bb[3]}`);
                    } else {
                        reject(new Error('No results'));
                    }
                });
            }).on('error', reject);
        });
        spinner.stop(`✓ Resolved bbox via Nominatim: ${bbox}`);
        return bbox;
    } catch (error) {
        spinner.stop();
        console.error(`❌ Could not resolve bbox. Use --bbox to specify manually.`);
        process.exit(1);
    }
}

async function main() {
    const config = parseArgs();
    const areaSlug = slugify(config.area);

    console.log('');
    console.log('🕰️  Historical OSM Snapshot Fetcher');
    console.log('─'.repeat(60));
    console.log(`   Area:        ${config.area}`);
    console.log(`   Date range:  ${config.startYear} - ${config.endYear}`);
    console.log(`   Interval:    ${config.intervalMonths} month(s)`);
    console.log(`   Output dir:  ${config.outputDir}`);
    console.log(`   Concurrency: ${config.concurrency}`);
    console.log(`   Include POI: ${config.includePoi ? 'yes' : 'no'}`);
    console.log('─'.repeat(60));

    await fs.promises.mkdir(config.outputDir, { recursive: true });
    const bbox = await resolveBbox(config.area, config.bbox);
    const layers = getHistoryLayers(config.includePoi);

    console.log(`\n📊 ${layers.length} layer(s) will be queried per snapshot:`);
    for (const l of layers) {
        const safe = l.filters.filter(isFilterSafe).length;
        const total = l.filters.length;
        const skipped = total - safe;
        console.log(`   ${l.name}: ${safe}/${total} filters${skipped > 0 ? ` (${skipped} broad-tag filters skipped)` : ''}`);
    }

    const dates = generateDates(config.startYear, config.endYear, config.intervalMonths);
    console.log(`\n📅 ${dates.length} snapshot(s) to fetch`);

    const toFetch = [];
    const skipped = [];
    for (const date of dates) {
        const filename = getOutputFilename(areaSlug, date);
        const outputPath = path.join(config.outputDir, filename);
        try {
            await fs.promises.access(outputPath);
            skipped.push(filename);
        } catch {
            toFetch.push({ date, outputPath, filename });
        }
    }

    if (skipped.length > 0) {
        console.log(`⏭️  Skipping ${skipped.length} existing snapshot(s)`);
    }

    if (toFetch.length === 0) {
        console.log('\n✅ All snapshots already exist!');
    } else {
        console.log(`\n🚀 Fetching ${toFetch.length} snapshot(s)...\n`);

        for (const item of toFetch) {
            try {
                await fetchSnapshot({
                    date: item.date,
                    bbox,
                    outputPath: item.outputPath,
                    layers,
                    concurrency: config.concurrency,
                });
            } catch (error) {
                console.error(`\n❌ Failed ${item.filename}: ${error.message}`);
            }
            console.log('');
        }
    }

    // Update manifest (merge with existing data from other cities)
    const manifestPath = path.join(config.outputDir, 'manifest.json');
    let manifest = { generatedAt: new Date().toISOString(), cities: {} };
    try {
        const existing = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
        if (existing.cities) {
            manifest.cities = existing.cities;
        } else if (existing.areaSlug && existing.snapshots) {
            manifest.cities[existing.areaSlug] = {
                area: existing.area,
                snapshots: existing.snapshots,
            };
        }
    } catch {}

    manifest.cities[areaSlug] = {
        area: config.area,
        snapshots: dates.map(date => ({
            date,
            file: getOutputFilename(areaSlug, date),
        })),
    };
    manifest.generatedAt = new Date().toISOString();

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`📋 Manifest saved to ${manifestPath} (${Object.keys(manifest.cities).length} city/cities)`);
    console.log('\n✨ Done!\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});
