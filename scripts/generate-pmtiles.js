#!/usr/bin/env node

/**
 * Generate PMtiles from multiple areas
 * 
 * Usage:
 *   node scripts/generate-pmtiles.js [options] <area1> [area2] [area3] ...
 * 
 * Options:
 *   --output <file>     Output PMtiles file path (default: all.pmtiles)
 *   --areas <list>      Comma-separated list of areas (alternative to positional args)
 *   --endpoint <url>    Overpass API endpoint (passed to overpass-to-geojson.js)
 *   --include-layers    Comma-separated list of layer names to include
 *   --exclude-layers    Comma-separated list of layer names to exclude
 *   --include-poi       Include POI (Point of Interest) layers
 *   --skip-geojson      Skip GeoJSON generation if files already exist
 *   --skip-existing-geojsons   Alias for --skip-geojson
 *   --cleanup           Remove GeoJSON files after PMtiles generation
 *   --help, -h          Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const AREA_ALIASES = {
    'south america': [
        'Argentina',
        'Bolivia',
        'Brazil',
        'Chile',
        'Colombia',
        'Ecuador',
        'Guyana',
        'Paraguay',
        'Peru',
        'Suriname',
        'Uruguay',
        'Venezuela'
    ],
    'iberian peninsula': [
        'Spain',
        'Portugal',
        'Andorra',
        'Gibraltar'
    ],
    'europe': [
        'Austria',
        'Belgium',
        'Denmark',
        'Finland',
        'France',
        'Germany',
        'Ireland',
        'Italy',
        'Luxembourg',
        'Netherlands',
        'Norway',
        'Portugal',
        'Spain',
        'Sweden',
        'Switzerland'
    ],
    'uk': [
        'United Kingdom'
    ]
};

// Path to the overpass-to-geojson script
const OVERPASS_SCRIPT = path.join(__dirname, 'overpass-to-geojson.js');

function normalizeAreaKey(value) {
    return value.trim().toLowerCase();
}

function expandAreaAliases(areas) {
    const expanded = [];
    areas.forEach(area => {
        const aliasKey = normalizeAreaKey(area);
        const aliasAreas = AREA_ALIASES[aliasKey];
        if (aliasAreas) {
            expanded.push(...aliasAreas);
        } else {
            expanded.push(area);
        }
    });
    return expanded;
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        output: 'all.pmtiles',
        areas: [],
        endpoint: null,
        includeLayers: null,
        excludeLayers: null,
        includePoi: false,
        skipGeoJSON: false,
        cleanup: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--output' && i + 1 < args.length) {
            config.output = args[++i];
        } else if (arg === '--areas' && i + 1 < args.length) {
            // Parse comma-separated areas
            config.areas = args[++i].split(',').map(a => a.trim()).filter(Boolean);
        } else if (arg === '--endpoint' && i + 1 < args.length) {
            config.endpoint = args[++i];
        } else if (arg === '--include-layers' && i + 1 < args.length) {
            config.includeLayers = args[++i].split(',').map(s => s.trim()).filter(Boolean);
        } else if (arg === '--exclude-layers' && i + 1 < args.length) {
            config.excludeLayers = args[++i].split(',').map(s => s.trim()).filter(Boolean);
        } else if (arg === '--include-poi') {
            config.includePoi = true;
        } else if (arg === '--skip-geojson') {
            config.skipGeoJSON = true;
        } else if (arg === '--skip-existing-geojsons') {
            config.skipGeoJSON = true;
        } else if (arg === '--cleanup') {
            config.cleanup = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Generate PMtiles from multiple areas

Usage:
  node scripts/generate-pmtiles.js [options] <area1> [area2] [area3] ...

Options:
  --output <file>     Output PMtiles file path (default: all.pmtiles)
  --areas <list>      Comma-separated list of areas (alternative to positional args)
  --endpoint <url>    Overpass API endpoint (passed to overpass-to-geojson.js)
  --include-layers    Comma-separated list of layer names to include
  --exclude-layers    Comma-separated list of layer names to exclude
  --include-poi       Include POI (Point of Interest) layers
  --skip-geojson      Skip GeoJSON generation if files already exist
  --skip-existing-geojsons   Alias for --skip-geojson
  --cleanup           Remove GeoJSON files after PMtiles generation
  --help, -h          Show this help message

Examples:
  node scripts/generate-pmtiles.js "Brazil" "Spain"
  node scripts/generate-pmtiles.js --areas "Brazil,Spain" --output world.pmtiles
  node scripts/generate-pmtiles.js "Brazil" "Spain" --cleanup

Aliases:
  "South America" -> Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname, Uruguay, Venezuela
  "Iberian Peninsula" -> Spain, Portugal, Andorra, Gibraltar
  "europe" -> Austria, Belgium, Denmark, Finland, France, Germany, Ireland, Italy, Luxembourg, Netherlands, Norway, Portugal, Spain, Sweden, Switzerland
  "uk" -> United Kingdom
            `);
            process.exit(0);
        } else if (!arg.startsWith('--')) {
            // Positional argument - treat as area name
            config.areas.push(arg);
        }
    }

    config.areas = expandAreaAliases(config.areas);
    return config;
}

// Run overpass-to-geojson.js for a single area
async function generateGeoJSONForArea(area, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const args = ['--from-layers', '--area', area, '--output', outputPath];
        if (options.endpoint) {
            args.push('--endpoint', options.endpoint);
        }
        if (options.includeLayers && options.includeLayers.length > 0) {
            args.push('--include-layers', options.includeLayers.join(','));
        }
        if (options.excludeLayers && options.excludeLayers.length > 0) {
            args.push('--exclude-layers', options.excludeLayers.join(','));
        }
        if (options.includePoi) {
            args.push('--include-poi');
        }

        console.log(`\n📥 Generating GeoJSON for: ${area}`);
        
        const child = spawn('node', [OVERPASS_SCRIPT, ...args], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`overpass-to-geojson.js exited with code ${code} for area: ${area}`));
            }
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to spawn overpass-to-geojson.js: ${error.message}`));
        });
    });
}

// Get the expected output filename for an area (matching overpass-to-geojson.js logic)
function getExpectedGeoJSONFilename(area) {
    // This matches the logic in overpass-to-geojson.js generateDefaultFilename
    const areaSlug = slugify(area);
    return `${areaSlug}.geojson`;
}

// Slugify function (from overpass-to-geojson.js)
function slugify(str) {
    const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·/_,:;';
    const b = 'aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz------';
    const p = new RegExp(a.split('').join('|'), 'g');
    return str.toString().toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
        .replace(/&/g, '-and-') // Replace & with 'and'
        .replace(/[^\w-]+/g, '') // Remove all non-word characters
        .replace(/--+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, ''); // Trim - from end of text
}

function shellQuote(value) {
    const str = String(value);
    if (/^[A-Za-z0-9_\/\.\-=:]+$/.test(str)) {
        return str;
    }
    return `"${str.replace(/["\\]/g, '\\$&')}"`;
}

// Check if tippecanoe is available
async function checkTippecanoe() {
    return new Promise((resolve) => {
        const child = spawn('tippecanoe', ['--version'], {
            stdio: 'pipe'
        });

        child.on('close', (code) => {
            resolve(code === 0);
        });

        child.on('error', () => {
            resolve(false);
        });
    });
}

// Run tippecanoe to generate PMtiles
async function generatePMtiles(geojsonFiles, outputPath) {
    return new Promise((resolve, reject) => {
        // Check if tippecanoe is available
        checkTippecanoe().then(available => {
            if (!available) {
                reject(new Error('tippecanoe is not installed or not in PATH. Please install it first.'));
                return;
            }

            console.log(`\n🗺️  Generating PMtiles from ${geojsonFiles.length} GeoJSON file(s)...`);
            console.log(`   Files: ${geojsonFiles.map(f => path.basename(f)).join(', ')}`);

            const args = [
                '-o', outputPath,
                '--force',
                '--maximum-zoom=g',
                '--generate-ids',
                '-l', 'default',
                ...geojsonFiles
            ];

            const commandPreview = ['tippecanoe', ...args].map(shellQuote).join(' ');
            console.log(`   Command: ${commandPreview}`);

            const child = spawn('tippecanoe', args, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`tippecanoe exited with code ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(new Error(`Failed to spawn tippecanoe: ${error.message}`));
            });
        });
    });
}

// Check if a file exists
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Main function
async function main() {
    try {
        const config = parseArgs();

        if (config.areas.length === 0) {
            console.error('❌ Error: No areas specified');
            console.error('   Use --areas "Area1,Area2" or provide areas as positional arguments');
            console.error('   Run with --help for usage information');
            process.exit(1);
        }

        console.log('');
        console.log('🚀 PMtiles Generator');
        console.log('─'.repeat(60));
        console.log(`   Areas: ${config.areas.join(', ')}`);
        console.log(`   Output: ${config.output}`);
        console.log(`   Skip GeoJSON: ${config.skipGeoJSON ? 'YES' : 'NO'}`);
        console.log(`   Include layers: ${config.includeLayers ? config.includeLayers.join(', ') : 'ALL'}`);
        console.log(`   Exclude layers: ${config.excludeLayers ? config.excludeLayers.join(', ') : 'NONE'}`);
        console.log(`   Include POI: ${config.includePoi ? 'YES' : 'NO'}`);
        console.log('─'.repeat(60));

        const geojsonFiles = [];
        const cwd = process.cwd();
        console.log(`\n📂 Working directory: ${cwd}`);

        // Generate GeoJSON for each area
        for (const area of config.areas) {
            const expectedFilename = getExpectedGeoJSONFilename(area);
            const expectedPath = path.join(cwd, expectedFilename);
            geojsonFiles.push(expectedPath);

            console.log(`\n🔍 Checking area: "${area}"`);
            console.log(`   Expected filename: ${expectedFilename}`);
            console.log(`   Expected path: ${expectedPath}`);

            const fileExistsResult = await fileExists(expectedPath);
            console.log(`   File exists: ${fileExistsResult ? 'YES' : 'NO'}`);
            console.log(`   Skip flag enabled: ${config.skipGeoJSON ? 'YES' : 'NO'}`);

            // Check if file already exists and skip-geojson is set
            if (config.skipGeoJSON && fileExistsResult) {
                console.log(`\n⏭️  SKIPPING GeoJSON generation for "${area}"`);
                console.log(`   Reason: --skip-geojson flag is set AND file already exists`);
                console.log(`   Using existing file: ${expectedPath}`);
                continue;
            }

            if (config.skipGeoJSON && !fileExistsResult) {
                console.log(`\n⚠️  Skip flag is set but file doesn't exist - will generate`);
            }

            try {
                await generateGeoJSONForArea(area, expectedPath, {
                    endpoint: config.endpoint,
                    includeLayers: config.includeLayers,
                    excludeLayers: config.excludeLayers,
                    includePoi: config.includePoi
                });
            } catch (error) {
                console.error(`\n❌ Failed to generate GeoJSON for "${area}": ${error.message}`);
                throw error;
            }
        }

        // Verify all GeoJSON files exist
        console.log(`\n✅ Verifying GeoJSON files before PMtiles generation...`);
        const missingFiles = [];
        const existingFiles = [];
        for (const file of geojsonFiles) {
            const exists = await fileExists(file);
            if (!exists) {
                missingFiles.push(path.basename(file));
                console.log(`   ❌ Missing: ${path.basename(file)} (${file})`);
            } else {
                existingFiles.push(file);
                console.log(`   ✓ Found: ${path.basename(file)} (${file})`);
            }
        }

        if (missingFiles.length > 0) {
            console.error(`\n❌ Error: ${missingFiles.length} GeoJSON file(s) not found:`);
            missingFiles.forEach(f => console.error(`   - ${f}`));
            throw new Error(`GeoJSON files not found: ${missingFiles.join(', ')}`);
        }

        console.log(`\n📊 Summary: ${existingFiles.length} GeoJSON file(s) ready for PMtiles generation`);

        // Generate PMtiles
        await generatePMtiles(geojsonFiles, config.output);

        // Cleanup GeoJSON files if requested
        if (config.cleanup) {
            console.log(`\n🧹 Cleaning up GeoJSON files...`);
            for (const file of geojsonFiles) {
                try {
                    await fs.unlink(file);
                    console.log(`   ✓ Removed ${path.basename(file)}`);
                } catch (error) {
                    console.warn(`   ⚠️  Failed to remove ${path.basename(file)}: ${error.message}`);
                }
            }
        }

        console.log('');
        console.log('✨ Done!');
        console.log(`   PMtiles file: ${config.output}`);
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, generateGeoJSONForArea, generatePMtiles };

