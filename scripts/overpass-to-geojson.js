#!/usr/bin/env node

/**
 * Overpass Query to GeoJSON Converter
 * 
 * Usage:
 *   node scripts/overpass-to-geojson.js [options]
 * 
 * Options:
 *   --query <file>      Path to Overpass query file (default: reads from stdin)
 *   --output <file>     Output GeoJSON file path (default: output.geojson)
 *   --area <name>       Area name for geocodeArea (default: Brazil)
 *   --endpoint <url>    Overpass API endpoint (default: https://overpass-api.de/api/interpreter)
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const osmtogeojson = require('osmtogeojson');

// Default configuration
const DEFAULTS = {
    endpoint: 'https://overpass-api.de/api/interpreter',
    output: 'output.geojson',
    area: 'Brazil'
};

// Area ID overrides (from constants.js)
const AREA_ID_OVERRIDES = {
    'Vitória, Espirito Santo, Brasil': 3601825817,
    'Brasília, Distrito Federal, Brasil': 3602662005,
    'København, Capital RegionDenmark, Denmark': 3613707878,
    'Comuna 1, Buenos Aires, Argentina': 3601224652,
    'Stockholm, Stockholm, Sweden': 3600398021,
    'Madri, Madrid, Espanha': 3605326784,
};

// Generate smart default filename based on parameters
function generateDefaultFilename(config) {
    const parts = [];
    
    // If query file provided, use its name (without extension) as prefix
    if (config.queryFile) {
        const queryName = path.basename(config.queryFile, path.extname(config.queryFile));
        parts.push(queryName);
    }
    
    // Add area name (slugified)
    if (config.area && config.area !== DEFAULTS.area) {
        const areaSlug = slugify(config.area);
        parts.push(areaSlug);
    }
    
    // Add suffix if using --from-layers
    if (config.fromLayers) {
        parts.push('layers');
    }
    
    // If no parts, use default
    if (parts.length === 0) {
        return 'output.geojson';
    }
    
    return `${parts.join('-')}.geojson`;
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = { ...DEFAULTS };
    let outputExplicitlySet = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--query' && i + 1 < args.length) {
            config.queryFile = args[++i];
        } else if (arg === '--output' && i + 1 < args.length) {
            config.output = args[++i];
            outputExplicitlySet = true;
        } else if (arg === '--area' && i + 1 < args.length) {
            config.area = args[++i];
        } else if (arg === '--endpoint' && i + 1 < args.length) {
            config.endpoint = args[++i];
        } else if (arg === '--from-layers') {
            config.fromLayers = true;
        } else if (arg === '--include-layers' && i + 1 < args.length) {
            config.includeLayers = args[++i].split(',').map(s => s.trim()).filter(s => s);
        } else if (arg === '--exclude-layers' && i + 1 < args.length) {
            config.excludeLayers = args[++i].split(',').map(s => s.trim()).filter(s => s);
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Overpass Query to GeoJSON Converter

Usage:
  node scripts/overpass-to-geojson.js [options]

Options:
  --query <file>      Path to Overpass query file (if not provided, reads from stdin)
  --output <file>     Output GeoJSON file path (default: auto-generated from parameters)
  --area <name>       Area name to override {{geocodeArea:...}} in query (default: Brazil)
  --endpoint <url>    Overpass API endpoint (default: https://overpass-api.de/api/interpreter)
  --from-layers       Generate query from layers.json using the same logic as OSMController
  --include-layers    Comma-separated list of layer names to include (only with --from-layers)
  --exclude-layers    Comma-separated list of layer names to exclude (only with --from-layers)
  --help, -h          Show this help message

Examples:
  node scripts/overpass-to-geojson.js --query query.txt --output brazil.geojson
  node scripts/overpass-to-geojson.js --query query.txt --area "Spain" --output spain.geojson
  node scripts/overpass-to-geojson.js --area "Spain" --output spain.geojson
  node scripts/overpass-to-geojson.js --from-layers --area "Spain" --output spain.geojson
  node scripts/overpass-to-geojson.js --from-layers --area "Spain" --include-layers "Ciclovia,Ciclofaixa"
  node scripts/overpass-to-geojson.js --from-layers --area "Spain" --exclude-layers "Proibido,Baixa velocidade"
  echo '[out:json]; node["amenity"="bicycle_rental"]; out;' | node scripts/overpass-to-geojson.js
            `);
            process.exit(0);
        }
    }
    
    // Validate that include/exclude layers are only used with --from-layers
    if ((config.includeLayers || config.excludeLayers) && !config.fromLayers) {
        console.warn('⚠️  Warning: --include-layers and --exclude-layers are only effective with --from-layers');
    }
    
    // Generate smart default filename if output not explicitly provided
    if (!outputExplicitlySet) {
        config.output = generateDefaultFilename(config);
    }

    return config;
}

// Read query from file or stdin, or generate from layers
async function readQuery(config) {
    // If --from-layers is specified, generate query from layers.json
    if (config.fromLayers) {
        console.log('📋 Generating query from layers.json...');
        const spinner = new Spinner('Resolving area...');
        spinner.start();
        
        try {
            const areaId = await getAreaId(config.area, spinner);
            spinner.stop(`✓ Resolved "${config.area}" to area ID ${areaId}`);
            
            const query = generateQueryFromLayers(
                areaId,
                null, // bbox
                config.includeLayers,
                config.excludeLayers
            );
            return query;
        } catch (error) {
            spinner.stop();
            // Preserve validation errors (they already have helpful messages)
            if (error.message.includes('Unknown layer(s)')) {
                throw error;
            }
            throw new Error(`Failed to generate query from layers: ${error.message}`);
        }
    }
    
    if (config.queryFile) {
        return fs.promises.readFile(config.queryFile, 'utf8');
    }

    // Read from stdin
    return new Promise((resolve, reject) => {
        let input = '';
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', (chunk) => {
            input += chunk;
        });
        
        process.stdin.on('end', () => {
            resolve(input);
        });
        
        process.stdin.on('error', reject);
        
        // If no input within 100ms, use default query
        setTimeout(() => {
            if (!input) {
                resolve(getDefaultQuery(config.area));
            }
        }, 100);
    });
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
function generateQueryFromLayers(areaId, bbox = null, includeLayers = null, excludeLayers = null) {
    const layersPath = path.join(__dirname, '..', 'src', 'layers.json');
    const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
    
    // Generate IDs for layers (same as OSMController.getLayers)
    layers.forEach(l => {
        l.id = slugify(l.name);
    });
    
    let filteredLayers = layers.filter(l => l.filters);
    
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

    return `
        [out:json][timeout:500];
        ${!bbox && `area(${areaId})->.a;`}
        (
            ${body}
        );
        out body geom;
    `;
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

// Convert Overpass Turbo {{geocodeArea:...}} syntax to Overpass API syntax
async function convertGeocodeArea(query, overrideArea = null) {
    // Replace {{geocodeArea:AreaName}}->.a; or {{geocodeArea:AreaName}} with proper Overpass area query
    // Match the full pattern including optional arrow assignment
    const geocodeAreaRegex = /\{\{geocodeArea:([^}]+)\}\}(->\.[a-zA-Z_]+;)?/g;
    const matches = [...query.matchAll(geocodeAreaRegex)];
    
    if (matches.length === 0) {
        // If no geocodeArea found but overrideArea is provided, inject it
        if (overrideArea) {
            console.log(`   ℹ️  No {{geocodeArea:...}} found in query, but --area provided.`);
            console.log(`   Adding area "${overrideArea}" to query...`);
            // Try to find a good place to inject it - look for area.a references
            if (query.includes('(area.a)')) {
                // Inject at the beginning after [out:json]
                query = query.replace(/\[out:json\]/, `[out:json]\n{{geocodeArea:${overrideArea}}}->.a;`);
                // Now we have a geocodeArea, so re-run the conversion
                return convertGeocodeArea(query, overrideArea);
            } else {
                // No area.a found, can't inject meaningfully
                console.log(`   ⚠️  Could not find area references in query, skipping area injection.`);
            }
        }
        return query;
    }
    
    // If overrideArea is provided, replace all geocodeArea references with it
    let areaNames;
    if (overrideArea) {
        console.log(`   ℹ️  Overriding area(s) with "${overrideArea}" from --area parameter`);
        areaNames = [overrideArea];
    } else {
        // Resolve all unique area names from the query
        areaNames = [...new Set(matches.map(m => m[1].trim()))];
    }
    
    const areaMap = new Map();
    
    const spinner = new Spinner('Resolving area names...');
    spinner.start();
    
    const resolvedAreas = [];
    
    try {
        for (const area of areaNames) {
            try {
                const resolved = await resolveAreaToRelationId(area, spinner);
                areaMap.set(area, resolved);
                resolvedAreas.push(`   ✓ Resolved "${area}" to area ID ${resolved.areaId}`);
            } catch (error) {
                spinner.stop();
                throw new Error(`Failed to resolve area "${area}": ${error.message}`);
            }
        }
        spinner.stop();
        // Print all resolved areas
        resolvedAreas.forEach(msg => console.log(msg));
    } catch (error) {
        spinner.stop();
        throw error;
    }
    
    // Replace all occurrences - use the resolved area for all matches
    const resolvedArea = areaMap.values().next().value; // Get the first (and possibly only) resolved area
    
    return query.replace(geocodeAreaRegex, (match, area, assignment) => {
        // Use the original assignment if provided, otherwise default to ->.a;
        const target = assignment || '->.a;';
        // Use area() function with the area ID
        return `area(${resolvedArea.areaId})${target}`;
    });
}

// Generate default query based on the provided query template
function getDefaultQuery(area) {
    return `[out:json][timeout:500];     
{{geocodeArea:${area}}}->.a;
(
    node["shop"="bicycle"](area.a);
    way["shop"="bicycle"](area.a);
    node["amenity"="bicycle_rental"](area.a);
    way["amenity"="bicycle_rental"](area.a);
    node["amenity"="bicycle_parking"](area.a);
    way["amenity"="bicycle_parking"](area.a);
    way["highway"="cycleway"](area.a);
    
    way["cycleway"="track"](area.a);
    way["cycleway:left"="track"](area.a);
    way["cycleway:right"="track"](area.a);
    way["cycleway"="opposite_track"](area.a);
    way["cycleway:left"="opposite_track"](area.a);
    way["cycleway:right"="opposite_track"](area.a);
    way["cycleway"="lane"](area.a);
    way["cycleway:left"="lane"](area.a);
    way["cycleway:right"="lane"](area.a);
    way["cycleway:both"="lane"](area.a);
    way["cycleway"="opposite_lane"](area.a);
    way["cycleway:right"="opposite_lane"](area.a);
    way["cycleway:left"="opposite_lane"](area.a);
    way["highway"="footway"]["bicycle"="designated"](area.a);
    way["highway"="pedestrian"]["bicycle"="designated"](area.a);
    way["highway"="pedestrian"]["bicycle"="yes"](area.a);
    way["cycleway"="sidepath"](area.a);
    way["cycleway:left"="sidepath"](area.a);
    way["cycleway:right"="sidepath"](area.a);
    way["cycleway"="buffered_lane"](area.a);
    way["cycleway:left"="buffered_lane"](area.a);
    way["cycleway:right"="buffered_lane"](area.a);
    way["cycleway"="shared_lane"](area.a);
    way["cycleway:left"="shared_lane"](area.a);
    way["cycleway:right"="shared_lane"](area.a);
    way["cycleway"="share_busway"](area.a);
    way["cycleway:left"="share_busway"](area.a);
    way["cycleway:right"="share_busway"](area.a);
    way["cycleway"="opposite_share_busway"](area.a);

    way["maxspeed"="30"](area.a);
    way["maxspeed"="20"](area.a);

    way["highway"="living_street"]["bicycle"="yes"](area.a);
    way["highway"="track"]["bicycle"="designated"](area.a);
    way["highway"="track"]["bicycle"="yes"](area.a);
    way["highway"="path"]["bicycle"="designated"](area.a);
    way["highway"="path"]["bicycle"="yes"](area.a);

    way["bicycle"="no"](area.a);
    way["bicycle"="dismount"](area.a);

);
out body geom;`;
}

// Execute Overpass query
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
        console.log('📥 Reading Overpass query...');
        let query = await readQuery(config);
        
        // Trim whitespace
        query = query.trim();
        
        if (!query) {
            console.error('❌ Error: No query provided');
            process.exit(1);
        }

        // Convert Overpass Turbo syntax to Overpass API syntax
        // Skip conversion if query was generated from layers (it's already in correct format)
        // Always convert if geocodeArea is found, or if --area is provided explicitly
        const hasGeocodeArea = query.includes('{{geocodeArea:');
        const hasAreaOverride = config.area !== DEFAULTS.area;
        
        if (!config.fromLayers && (hasGeocodeArea || hasAreaOverride)) {
            console.log('🔄 Converting Overpass Turbo syntax to Overpass API syntax...');
            const overrideArea = hasAreaOverride ? config.area : null;
            query = await convertGeocodeArea(query, overrideArea);
            console.log('');
        }

        console.log('');
        console.log('📋 Converted query:');
        console.log('─'.repeat(60));
        console.log(query);
        console.log('─'.repeat(60));
        console.log('');
        console.log(`🌐 Executing query against ${config.endpoint}...`);
        
        const querySpinner = new Spinner('Executing query...');
        querySpinner.start();
        
        const osmData = await executeOverpassQuery(query, config.endpoint, querySpinner);
        
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
        
        // If it's a query-related error, provide helpful hints
        if (error.message.includes('parse error') || error.message.includes('Unknown type')) {
            console.error('💡 Tip: Make sure your query uses valid Overpass QL syntax.');
            console.error('   If you\'re using {{geocodeArea:...}}, the script will convert it automatically.');
            console.error('');
        }
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, executeOverpassQuery, convertToGeoJSON };

