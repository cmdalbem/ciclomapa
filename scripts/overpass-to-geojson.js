#!/usr/bin/env node

/**
 * Overpass Query to GeoJSON Converter
 * 
 * Generates Overpass queries from layers.json and converts results to GeoJSON.
 * 
 * Usage:
 *   node scripts/overpass-to-geojson.js [options]
 * 
 * Required Options:
 *   --output <file>     Output GeoJSON file path
 *   --area <name>       Area name for the query
 * 
 * Optional Options:
 *   --endpoint <url>    Overpass API endpoint (default: first server from fallback list)
 *   --include-layers    Comma-separated list of layer names to include
 *   --exclude-layers    Comma-separated list of layer names to exclude
 *   --include-poi        Include POI (Point of Interest) layers in the query
 * 
 * Note: If no --endpoint is specified, the script will automatically try multiple
 * Overpass API servers in sequence if one fails, providing better reliability.
 * 
 * By default, POI layers are excluded. Use --include-poi to include them.
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const osmtogeojson = require('osmtogeojson');

const OVERPASS_SERVERS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter'
];

const DEFAULT_OVERPASS_ENDPOINT = OVERPASS_SERVERS[0];

// Area ID overrides (from constants.js)
const AREA_ID_OVERRIDES = {
    'Vitória, Espirito Santo, Brasil': 3601825817,
    'Brasília, Distrito Federal, Brasil': 3602662005,
    'København, Capital RegionDenmark, Denmark': 3613707878,
    'Comuna 1, Buenos Aires, Argentina': 3601224652,
    'Stockholm, Stockholm, Sweden': 3600398021,
    'Madri, Madrid, Espanha': 3605326784,
};

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        endpoint: DEFAULT_OVERPASS_ENDPOINT
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--output' && i + 1 < args.length) {
            config.output = args[++i];
        } else if (arg === '--area' && i + 1 < args.length) {
            config.area = args[++i];
        } else if (arg === '--endpoint' && i + 1 < args.length) {
            config.endpoint = args[++i];
        } else if (arg === '--include-layers' && i + 1 < args.length) {
            config.includeLayers = args[++i].split(',').map(s => s.trim()).filter(s => s);
        } else if (arg === '--exclude-layers' && i + 1 < args.length) {
            config.excludeLayers = args[++i].split(',').map(s => s.trim()).filter(s => s);
        } else if (arg === '--include-poi') {
            config.includePoi = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Overpass Query to GeoJSON Converter

Generates Overpass queries from layers.json and converts results to GeoJSON.

Usage:
  node scripts/overpass-to-geojson.js [options]

Required Options:
  --output <file>     Output GeoJSON file path
  --area <name>       Area name for the query

Optional Options:
  --endpoint <url>    Overpass API endpoint (default: first server from fallback list)
  --include-layers    Comma-separated list of layer names to include
  --exclude-layers    Comma-separated list of layer names to exclude
  --include-poi        Include POI (Point of Interest) layers in the query
  --help, -h          Show this help message

Note: If no --endpoint is specified, the script will automatically try multiple
Overpass API servers in sequence if one fails, providing better reliability.

By default, POI layers are excluded. Use --include-poi to include them.

Examples:
  node scripts/overpass-to-geojson.js --area "Spain" --output spain.geojson
  node scripts/overpass-to-geojson.js --area "Brazil" --output brazil.geojson --include-layers "Ciclovia,Ciclofaixa"
  node scripts/overpass-to-geojson.js --area "France" --output france.geojson --exclude-layers "Proibido,Baixa velocidade"
  node scripts/overpass-to-geojson.js --area "Germany" --output germany.geojson --include-poi
            `);
            process.exit(0);
        }
    }
    
    // Validate required parameters
    if (!config.output) {
        console.error('❌ Error: Missing required parameter --output');
        console.error('   Usage: --output <file>');
        process.exit(1);
    }
    
    if (!config.area) {
        console.error('❌ Error: Missing required parameter --area');
        console.error('   Usage: --area <name>');
        console.error('   Example: --area "Spain"');
        process.exit(1);
    }

    return config;
}

// Generate query from layers.json
async function generateQuery(config) {
    console.log('📋 Generating query from layers.json...');
    const spinner = new Spinner('Resolving area...');
    spinner.start();
    
    try {
        const areaId = await getAreaId(config.area, spinner);
        spinner.stop(`✓ Resolved "${config.area}" to area ID ${areaId}`);
        
        const result = generateQueryFromLayers(
            areaId,
            null, // bbox
            config.includeLayers,
            config.excludeLayers,
            config.includePoi
        );
        return result;
    } catch (error) {
        spinner.stop();
        // Preserve validation errors (they already have helpful messages)
        if (error.message.includes('Unknown layer(s)')) {
            throw error;
        }
        throw new Error(`Failed to generate query from layers: ${error.message}`);
    }
}

// Simple spinner utility for console animations
class Spinner {
    constructor(message = '') {
        this.message = message;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.interval = null;
        this.currentFrame = 0;
    }

    start() {
        if (this.interval) return;
        
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 100);
    }

    stop(finalMessage = '') {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        // Clear the spinner line and print final message
        process.stdout.write(`\r${' '.repeat(50)}\r`); // Clear line
        if (finalMessage) {
            console.log(finalMessage);
        }
    }

    update(message) {
        this.message = message;
    }
}

// Parse HTML error response from Overpass API to extract error messages
function parseHtmlError(html) {
    // Extract error messages from HTML - Overpass API uses <strong>Error</strong>: message
    const errorPattern = /<strong[^>]*>Error<\/strong>:\s*([^<\n]+)/gi;
    const errors = [];
    let match;
    
    while ((match = errorPattern.exec(html)) !== null) {
        const errorText = match[1].trim();
        if (errorText) {
            errors.push(errorText);
        }
    }
    
    if (errors.length > 0) {
        return errors.join('\n   ');
    }
    
    // Fallback: try to extract text content between <p> tags
    const pTagPattern = /<p[^>]*>([^<]+)<\/p>/gi;
    const textMatches = [];
    while ((match = pTagPattern.exec(html)) !== null) {
        const text = match[1].trim();
        if (text && !text.includes('ODbL') && !text.includes('openstreetmap.org')) {
            textMatches.push(text);
        }
    }
    
    if (textMatches.length > 0) {
        return textMatches.join('\n   ');
    }
    
    // Last resort: strip HTML tags and return first 200 chars
    const textContent = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    
    return textContent || 'Unknown error';
}

// Slugify function (from utils.js)
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

// Get area ID from area name (similar to OSMController.getAreaId)
async function getAreaId(areaName, spinner = null) {
    // Check overrides first
    if (AREA_ID_OVERRIDES[areaName]) {
        return AREA_ID_OVERRIDES[areaName];
    }
    
    // Otherwise resolve via Nominatim
    const resolved = await resolveAreaToRelationId(areaName, spinner);
    return resolved.areaId;
}

// Generate query from layers.json (same logic as OSMController.getQuery)
function generateQueryFromLayers(areaId, bbox = null, includeLayers = null, excludeLayers = null, includePoi = false) {
    const layersPath = path.join(__dirname, '..', 'src', 'layers.json');
    const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
    
    // Generate IDs for layers (same as OSMController.getLayers)
    layers.forEach(l => {
        l.id = slugify(l.name);
    });
    
    // Filter out layers without filters, debug layers, and POI layers (unless includePoi is true)
    let filteredLayers = layers.filter(l => {
        if (!l.filters) return false;
        if (l.onlyDebug) return false;
        if (!includePoi && l.type === 'poi') return false;
        return true;
    });
    
    if (!includePoi) {
        const poiCount = layers.filter(l => l.filters && !l.onlyDebug && l.type === 'poi').length;
        if (poiCount > 0) {
            console.log(`   ℹ️  Excluding ${poiCount} POI layer(s) (use --include-poi to include them)`);
        }
    }
    
    // Build a map of all available layer names and IDs for validation
    const availableLayersMap = new Map();
    filteredLayers.forEach(l => {
        const nameLower = l.name.toLowerCase();
        const idLower = l.id.toLowerCase();
        availableLayersMap.set(nameLower, l.name);
        availableLayersMap.set(idLower, l.name);
    });
    
    // Validate include layers - check all provided names exist
    if (includeLayers && includeLayers.length > 0) {
        const unmatched = [];
        includeLayers.forEach(providedName => {
            const providedLower = providedName.toLowerCase();
            if (!availableLayersMap.has(providedLower)) {
                unmatched.push(providedName);
            }
        });
        
        if (unmatched.length > 0) {
            const availableNames = Array.from(new Set(Array.from(availableLayersMap.values()))).sort();
            throw new Error(
                `Unknown layer(s) in --include-layers: ${unmatched.join(', ')}\n` +
                `Available layers: ${availableNames.join(', ')}`
            );
        }
        
        const includeSet = new Set(includeLayers.map(name => name.toLowerCase()));
        const beforeCount = filteredLayers.length;
        filteredLayers = filteredLayers.filter(l => {
            const nameLower = l.name.toLowerCase();
            const idLower = l.id.toLowerCase();
            return includeSet.has(nameLower) || includeSet.has(idLower);
        });
        const afterCount = filteredLayers.length;
        if (beforeCount !== afterCount) {
            console.log(`   ℹ️  Whitelist applied: ${afterCount} layer(s) included (from ${beforeCount} total)`);
        }
    }
    
    // Validate exclude layers - check all provided names exist
    if (excludeLayers && excludeLayers.length > 0) {
        const unmatched = [];
        excludeLayers.forEach(providedName => {
            const providedLower = providedName.toLowerCase();
            if (!availableLayersMap.has(providedLower)) {
                unmatched.push(providedName);
            }
        });
        
        if (unmatched.length > 0) {
            const availableNames = Array.from(new Set(Array.from(availableLayersMap.values()))).sort();
            throw new Error(
                `Unknown layer(s) in --exclude-layers: ${unmatched.join(', ')}\n` +
                `Available layers: ${availableNames.join(', ')}`
            );
        }
        
        const excludeSet = new Set(excludeLayers.map(name => name.toLowerCase()));
        const beforeCount = filteredLayers.length;
        filteredLayers = filteredLayers.filter(l => {
            const nameLower = l.name.toLowerCase();
            const idLower = l.id.toLowerCase();
            return !excludeSet.has(nameLower) && !excludeSet.has(idLower);
        });
        const afterCount = filteredLayers.length;
        if (beforeCount !== afterCount) {
            console.log(`   ℹ️  Blacklist applied: ${beforeCount - afterCount} layer(s) excluded (${afterCount} remaining)`);
        }
    }

    const body = filteredLayers.map(l =>
        (l.type === 'poi' ? ['node', 'way'] : ['way']).map(element =>
            l.filters.map(f =>
                element
                + (typeof f[0] === 'string' ?
                    `["${f[0]}"="${f[1]}"]`
                    :
                    f.map(f_inner =>
                        `["${f_inner[0]}"="${f_inner[1]}"]`
                    ).join(""))
                + (bbox ? 
                    `(${bbox});\n`
                    :
                    `(area.a);\n`)
            ).join("")
        ).join("")
    ).join("");

    const query = `
        [out:json][timeout:500];
        ${!bbox && `area(${areaId})->.a;`}
        (
            ${body}
        );
        out body geom;
    `;

    const includedLayerNames = filteredLayers.map(l => l.name).sort();

    return {
        query: query.trim(),
        layers: includedLayerNames
    };
}

// Resolve area name to relation ID using Nominatim
async function resolveAreaToRelationId(areaName, spinner = null) {
    return new Promise((resolve, reject) => {
        const encodedArea = encodeURIComponent(areaName);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedArea}&format=json&limit=1&addressdetails=1`;
        
        if (spinner) {
            spinner.update(`Resolving "${areaName}"...`);
        }
        
        https.get(nominatimUrl, {
            headers: {
                'User-Agent': 'CicloMapa Overpass Query Tool'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const results = JSON.parse(data);
                    if (results.length === 0) {
                        reject(new Error(`Could not find area: ${areaName}`));
                        return;
                    }
                    
                    // Find a relation result (prefer relations over other types)
                    const relation = results.find(r => r.osm_type === 'relation') || results[0];
                    
                    if (relation.osm_type === 'relation') {
                        // Convert relation ID to area ID: area_id = 3600000000 + relation_id
                        const areaId = 3600000000 + parseInt(relation.osm_id);
                        resolve({ areaId, relationId: relation.osm_id, displayName: relation.display_name });
                    } else {
                        reject(new Error(`No relation found for area: ${areaName}. Found ${relation.osm_type} instead.`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Nominatim response: ${e.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`Failed to query Nominatim: ${error.message}`));
        });
    });
}

// Execute Overpass query against a single endpoint
function executeOverpassQuery(query, endpoint, spinner = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(query)
            }
        };

        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
                if (spinner) {
                    spinner.update(`Executing query... (received ${(data.length / 1024).toFixed(1)} KB)`);
                }
            });

            res.on('end', () => {
                if (spinner) spinner.stop();
                if (res.statusCode !== 200) {
                    let errorMessage = `HTTP ${res.statusCode}`;
                    
                    // Check if response is HTML (Overpass API error)
                    if (data.trim().startsWith('<?xml') || data.includes('<html')) {
                        const parsedError = parseHtmlError(data);
                        errorMessage += `:\n   ${parsedError}`;
                    } else {
                        // Try to parse as JSON error
                        try {
                            const errorJson = JSON.parse(data);
                            if (errorJson.error) {
                                errorMessage += `: ${errorJson.error}`;
                            } else {
                                errorMessage += `: ${data.substring(0, 200)}`;
                            }
                        } catch {
                            errorMessage += `: ${data.substring(0, 200)}`;
                        }
                    }
                    
                    reject(new Error(errorMessage));
                    return;
                }

                try {
                    const json = JSON.parse(data);
                    
                    // Check for Overpass API errors in JSON response
                    if (json.error) {
                        reject(new Error(`Overpass API error: ${json.error}`));
                        return;
                    }
                    
                    resolve(json);
                } catch (e) {
                    reject(new Error(`Failed to parse JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', (error) => {
            if (spinner) spinner.stop();
            reject(error);
        });

        req.write(query);
        req.end();
    });
}

// Execute Overpass query with automatic fallback to multiple servers
async function executeOverpassQueryWithFallback(query, endpoint, spinner = null) {
    // If a custom endpoint is provided, use only that one
    if (endpoint !== DEFAULT_OVERPASS_ENDPOINT) {
        return executeOverpassQuery(query, endpoint, spinner);
    }
    
    // Otherwise, try servers in sequence until one succeeds
    const errors = [];
    
    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
        const server = OVERPASS_SERVERS[i];
        const serverNumber = i + 1;
        
        try {
            if (i === 0) {
                if (spinner) {
                    spinner.update(`Trying server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}...`);
                } else {
                    console.log(`   🔄 Trying server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}`);
                }
            } else {
                // Stop spinner before printing failure message
                if (spinner) spinner.stop();
                console.log(`   ⚠️  Server ${i}/${OVERPASS_SERVERS.length} failed, trying next...`);
                if (spinner) {
                    spinner.start();
                    spinner.update(`Trying server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}...`);
                } else {
                    console.log(`   🔄 Trying server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}`);
                }
            }
            
            const result = await executeOverpassQuery(query, server, spinner);
            
            // Stop spinner before printing success message
            if (spinner) spinner.stop();
            if (i > 0) {
                console.log(`   ✓ Successfully used fallback server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}`);
            } else {
                console.log(`   ✓ Successfully used server ${serverNumber}/${OVERPASS_SERVERS.length}: ${server}`);
            }
            
            return result;
        } catch (error) {
            errors.push({ server, error: error.message });
            
            // Stop spinner before printing error message
            if (spinner) spinner.stop();
            console.log(`   ❌ Server ${serverNumber}/${OVERPASS_SERVERS.length} failed: ${server}`);
            console.log(`      Error: ${error.message}`);
            
            if (i < OVERPASS_SERVERS.length - 1) {
                console.log(`   ↻ Routing to next server...`);
            }
        }
    }
    
    // All servers failed
    console.log('');
    const errorMessages = errors.map((e, idx) => `   ${idx + 1}. ${e.server}: ${e.error}`).join('\n');
    throw new Error(`All Overpass API servers failed:\n${errorMessages}`);
}

// Convert OSM JSON to GeoJSON
function convertToGeoJSON(osmData) {
    try {
        const geoJson = osmtogeojson(osmData);
        return geoJson;
    } catch (error) {
        throw new Error(`Failed to convert OSM to GeoJSON: ${error.message}`);
    }
}

// Save GeoJSON to file
async function saveGeoJSON(geoJson, outputPath) {
    const jsonString = JSON.stringify(geoJson, null, 2);
    await fs.promises.writeFile(outputPath, jsonString, 'utf8');
    console.log(`✅ GeoJSON saved to: ${outputPath}`);
    console.log(`   Features: ${geoJson.features.length}`);
}

// Main function
async function main() {
    try {
        const config = parseArgs();
        
        console.log('');
        console.log('📥 Generating Overpass query from layers.json...');
        const queryResult = await generateQuery(config);
        const query = queryResult.query;
        const layers = queryResult.layers;
        
        // Trim whitespace
        const trimmedQuery = query.trim();
        
        if (!trimmedQuery) {
            console.error('❌ Error: Failed to generate query');
            process.exit(1);
        }

        console.log('');
        console.log(`📊 Query includes ${layers.length} layer(s):`);
        console.log('─'.repeat(60));
        layers.forEach((layerName, index) => {
            console.log(`   ${index + 1}. ${layerName}`);
        });
        console.log('─'.repeat(60));
        console.log('');
        console.log('📋 Generated query:');
        console.log('─'.repeat(60));
        console.log(trimmedQuery);
        console.log('─'.repeat(60));
        console.log('');
        
        if (config.endpoint === DEFAULT_OVERPASS_ENDPOINT) {
            console.log(`🌐 Executing query (will try ${OVERPASS_SERVERS.length} servers if needed)...`);
        } else {
            console.log(`🌐 Executing query against ${config.endpoint}...`);
        }
        
        const querySpinner = new Spinner('Executing query...');
        querySpinner.start();
        
        const osmData = await executeOverpassQueryWithFallback(trimmedQuery, config.endpoint, querySpinner);
        
        console.log('');
        if (!osmData.elements || osmData.elements.length === 0) {
            console.warn('⚠️  Warning: No data returned from Overpass API');
        } else {
            console.log(`📊 Received ${osmData.elements.length} OSM elements`);
        }

        const convertSpinner = new Spinner('Converting to GeoJSON...');
        convertSpinner.start();
        const geoJson = convertToGeoJSON(osmData);
        convertSpinner.stop(`🔄 Converted to GeoJSON (${geoJson.features.length} features)`);

        console.log(`💾 Saving to ${config.output}...`);
        await saveGeoJSON(geoJson, config.output);

        console.log('');
        console.log('✨ Done!');
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

module.exports = { main, executeOverpassQuery, executeOverpassQueryWithFallback, convertToGeoJSON };

