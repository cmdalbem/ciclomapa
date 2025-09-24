import { get, set } from 'idb-keyval';

import firebase from 'firebase';

// import { cleanUpInternalTags, gzipCompress } from './geojsonUtils.js'
import { cleanUpInternalTags } from './geojsonUtils.js'
import { slugify, sizeOf } from './utils.js'
import { stringify, parse } from 'zipson';

import { osmi18n } from './osmi18n.js'

import {
    IS_PROD,
    DISABLE_LOCAL_STORAGE
} from './constants.js'


const DEFAULT_CITIES_COLLECTION = IS_PROD ? 'cities' : 'cities-dev';


const firebaseConfig = {
    apiKey: "AIzaSyDUbMY3UuyJ9vVVBblhUR9L1B3TV6a3eRU",
    authDomain: "ciclomapa-app.firebaseapp.com",
    databaseURL: "https://ciclomapa-app.firebaseio.com",
    projectId: "ciclomapa-app",
    storageBucket: "ciclomapa-app.appspot.com",
    messagingSenderId: "377722964538",
    appId: "1:377722964538:web:bc0fada0b3db0587514303"
};

class Storage {
    db;
    dataBuffer;
    
    // Constants for new chunking strategy
    static MAX_DOCUMENT_SIZE = 800 * 1024; // 800KB to stay under Firestore's 1MB limit
    static ESTIMATED_OVERHEAD = 1000; // bytes for Firestore metadata
    
    constructor() {
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: firebaseConfig.apiKey,
                authDomain: firebaseConfig.authDomain,
                projectId: firebaseConfig.projectId
            });
        }

        this.db = firebase.firestore();
    }

    getAllCitiesDocs() {
        return new Promise(resolve => {
            this.db.collection(DEFAULT_CITIES_COLLECTION)
                .where("part", "==", "")    
                .get()
                .then((querySnapshot) => {
                    console.debug('[Firestore] Documents found:');
                    querySnapshot.forEach((doc) => {
                        console.debug('• ' + doc.id, ' => ', doc.data());
                    });
        
                    resolve(querySnapshot);
                });
        });
    }

    getAllCitiesStats() {
        return new Promise(resolve => {
            this.db.collection("stats")
                .where("lengths.ciclovia", ">=", 0)    
                .get()
                    .then(querySnapshot => {
                        console.debug('[Firestore] Documents found:');

                        let docs = [];
                        querySnapshot.forEach(doc => {
                            let di = doc.data().lengths;
                            if (di && doc.id) {
                                di.total = di['ciclovia'];
                                di.total += di['ciclorrota'];
                                di.total += di['ciclofaixa'];
                                di.total += di['calcada-compartilhada'];
                                
                                console.debug(doc.id);
                                docs[doc.id] = di;
                            }
                        });
                        console.log(docs);
                        console.table(docs);
            
                        resolve(querySnapshot);
                });
        });
    }

    compressJson(_data) {
        // Deep object clone
        var data = JSON.parse(JSON.stringify(_data));
        let compressed;

        console.debug('JSON before compression: ', sizeOf(data));

        // @todo DOESNT WORK because Mapbox needs the OSM tags to render the layers
        // Minimize size by cleaning clearing OSM tags
        // cleanUpOSMTags(data);
        
        // I think it's not needed sincee stringify already does it?
        // Compress with gzip
        // compressed = gzipCompress(data);

        cleanUpInternalTags(data);

        compressed = stringify(data, { fullPrecisionFloats: true }); 

        console.debug('JSON after compression: ', sizeOf(compressed));

        return compressed;
    }

    saveGeoJSONToFirestore(name, jsonStr, lengths, part) {
        const now = new Date();
        let slug = slugify(name);

        if (!!part && part > 1) {
            slug += part;
        }

        return this.db.collection(DEFAULT_CITIES_COLLECTION).doc(slug).set({
            name: name,
            geoJson: jsonStr,
            updatedAt: now,
            lengths: lengths,
            part: part || ''
        });
    }

    saveStatsToFirestore(name, lengths) {
        let slug = slugify(name);

        return this.db.collection('stats').doc(slug).set({
            lengths: lengths
        });
    }

    save(name, geoJson, lengths) {
        return new Promise((resolve, reject) => {
            const now = new Date();

            // Save to Local Storage
            set(name, {
                geoJson: geoJson,
                updatedAt: now
            });

            // Save to Firestore using new chunked format
            try {
                console.debug(`[Firebase] Saving GeoJSON ${name} using new chunked format...`);
                
                // Save calculated lengths first
                this.saveStatsToFirestore(name, lengths)
                    .then(() => {
                        console.debug(`[Firebase] Lengths for ${name} saved successfully.`);
                    })
                    .catch(error => {
                        console.error("[Firebase] Error saving lengths: ", error);
                        reject(error);
                        return;
                    });

                // Save GeoJSON data using new chunking strategy
                this.saveWithChunking(name, geoJson, lengths)
                    .then(() => {
                        console.debug(`[Firebase] GeoJSON ${name} saved successfully using new format.`);
                        resolve();
                    })
                    .catch(error => {
                        console.error(`[Firebase] Error saving GeoJSON ${name}: `, error);
                        reject(error);
                    });

            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }

    printPOIsStats(geoJson) {
        if (!geoJson) {
            return;
        }
        
        let tagsCount = {};
        let valuesCount = {};
        
        geoJson.features.forEach(f => {
            // Only POIs
            if (f.properties.shop || f.properties.amenity) {
                for (let k in f.properties) {
                    const name = k;
                    tagsCount[name] = tagsCount[name] === undefined ? 1 : tagsCount[name]+1;

                    const value = f.properties[k];
                    valuesCount[value] = valuesCount[value] === undefined ? 1 : valuesCount[value]+1;
                }
            }
        });

        let tagsTable = [];
        for(let t in tagsCount) {
            const t2 = osmi18n[t];
            if (tagsCount[t] > 1) {
                tagsTable.push({
                    name: t,
                    i18n: t2,
                    count: tagsCount[t]
                });
            }
        }
        // console.table(tagsTable);

        let valuesTable = [];
        for(let t in valuesCount) {
            const t2 = osmi18n[t];
            if (valuesCount[t] > 1) {
                valuesTable.push({
                    name: t,
                    i18n: t2,
                    count: valuesCount[t]
                });
            }
        }
        // console.table(valuesTable);
    }

    // New chunking strategy methods
    async saveWithChunking(name, geoJson, lengths) {
        const compressed = this.compressJson(geoJson);
        const slug = slugify(name);
        
        // Calculate optimal chunk size
        const chunkSize = this.calculateOptimalChunkSize(compressed);
        const chunks = this.createChunks(compressed, chunkSize);
        
        console.debug(`[Storage] Splitting ${name} into ${chunks.length} chunks (${compressed.length} bytes total)`);
        
        // Save metadata first
        await this.db.collection(DEFAULT_CITIES_COLLECTION)
            .doc(`${slug}_metadata`)
            .set({
                name: name,
                totalChunks: chunks.length,
                totalSize: compressed.length,
                lengths: lengths,
                updatedAt: new Date(),
                format: 'chunked_v1'
            });
        
        // Save chunks in parallel
        const chunkPromises = chunks.map((chunk, index) => 
            this.db.collection(DEFAULT_CITIES_COLLECTION)
                .doc(`${slug}_chunk_${index + 1}`)
                .set({
                    data: chunk,
                    chunkNumber: index + 1,
                    totalChunks: chunks.length
                })
        );
        
        await Promise.all(chunkPromises);
        
        // Clean up old format data if it exists
        await this.cleanupOldFormat(name);
        
        console.debug(`[Storage] Successfully saved ${name} using new chunked format (${chunks.length} chunks)`);
    }
    
    calculateOptimalChunkSize(compressed) {
        const availableSize = Storage.MAX_DOCUMENT_SIZE - Storage.ESTIMATED_OVERHEAD;
        const chunksNeeded = Math.ceil(compressed.length / availableSize);
        return Math.ceil(compressed.length / chunksNeeded);
    }
    
    createChunks(data, chunkSize) {
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    async cleanupOldFormat(name) {
        const slug = slugify(name);
        
        // Delete old format documents
        const oldDocs = [
            slug,           // Main document
            slug + '2',     // Part 2
            slug + '3',     // Part 3
            slug + '4'      // Part 4
        ];
        
        const deletePromises = oldDocs.map(docId => 
            this.db.collection(DEFAULT_CITIES_COLLECTION).doc(docId).delete()
                .catch(error => {
                    // Ignore errors if document doesn't exist
                    console.debug(`[Storage] Could not delete old document ${docId}:`, error.message);
                })
        );
        
        await Promise.all(deletePromises);
        console.debug(`[Storage] Cleaned up old format documents for ${name}`);
    }
    
    async tryLoadNewFormat(slug) {
        try {
            // Check if metadata document exists (indicates new format)
            const metadataDoc = await this.db.collection(DEFAULT_CITIES_COLLECTION)
                .doc(`${slug}_metadata`)
                .get();
                
            if (!metadataDoc.exists) {
                return null; // Old format
            }
            
            const metadata = metadataDoc.data();
            console.debug(`[Storage] Found new format metadata for ${slug}: ${metadata.totalChunks} chunks`);
            
            // Load all chunks in parallel
            const chunkPromises = [];
            for (let i = 1; i <= metadata.totalChunks; i++) {
                chunkPromises.push(this.loadChunk(slug, i));
            }
            
            const chunks = await Promise.all(chunkPromises);
            
            // Reassemble data
            const compressed = chunks.join('');
            const geoJson = this.decompressData(compressed);
            
            return {
                geoJson: geoJson,
                updatedAt: metadata.updatedAt.toDate(),
                lengths: metadata.lengths
            };
            
        } catch (error) {
            console.debug(`[Storage] New format load failed for ${slug}:`, error);
            return null;
        }
    }
    
    async loadChunk(slug, chunkNumber) {
        const doc = await this.db.collection(DEFAULT_CITIES_COLLECTION)
            .doc(`${slug}_chunk_${chunkNumber}`)
            .get();
            
        if (!doc.exists) {
            throw new Error(`Chunk ${chunkNumber} not found for ${slug}`);
        }
        
        return doc.data().data;
    }
    
    decompressData(compressed) {
        try {
            return parse(compressed); // Zipson
        } catch (e) {
            // Fallback to JSON.parse for old data
            console.debug('[Storage] Zipson decompression failed, trying JSON.parse');
            return JSON.parse(compressed);
        }
    }

    getDataFromDB(slug, resolve, reject, part) {
        const slugWithPart = slug + (part || '');
        this.db.collection(DEFAULT_CITIES_COLLECTION).doc(slugWithPart).get().then(doc => {
            if (doc.exists) {
                let data = doc.data();

                console.debug("[Firebase] Retrieved document data:", data);

                if (!data.part || data.part === 1) {
                    // Recursion iteration 0
                    this.dataBuffer = {};
                    this.dataBuffer.geoJson = data.geoJson; 
                    this.dataBuffer.updatedAt = data.updatedAt; 
                    this.dataBuffer.lengths = data.lengths;
                    return this.getDataFromDB(slug, resolve, reject, 2);
                } else if (data.part >= 2) {
                    // Recursion iteration n
                    this.dataBuffer.geoJson += data.geoJson;
                    return this.getDataFromDB(slug, resolve, reject, data.part+1);
                }
            } else {
                console.debug("[Firebase] No document for: ", slugWithPart);

                // Check if recursion tail
                if (!!part) {
                    let ret = {};
                    ret.updatedAt = this.dataBuffer.updatedAt.toDate();
                    ret.lengths = this.dataBuffer.lengths;
    
                    try {
                        ret.geoJson = parse(this.dataBuffer.geoJson);
                    } catch(e) {
                        // Retrocompatibility, for when we didn't use Zipson compression
                        console.error(e);
                        ret.geoJson = JSON.parse(this.dataBuffer.geoJson);
                    }
                    
                    this.printPOIsStats(ret.geoJson);

                    resolve(ret);
                } else {
                    resolve();
                }
            }
        }).catch(error => {
            console.error(`[Firebase] Error getting document: ${slug}`, error);
            reject(error);
        });
    }

    load(name) {
        const slug = slugify(name);

        return new Promise((resolve, reject) => {
            if (!DISABLE_LOCAL_STORAGE) {
                get(name).then( local => {
                    if (local) {
                        resolve(local);
                    } else {
                        // Try new chunked format first, then fallback to old format
                        this.tryLoadNewFormat(slug)
                            .then(data => {
                                if (data) {
                                    console.debug(`[Storage] Loaded ${name} using new chunked format`);
                                    resolve(data);
                                } else {
                                    console.debug(`[Storage] Falling back to old format for ${name}`);
                                    this.getDataFromDB(slug, resolve, reject);
                                }
                            })
                            .catch(error => {
                                console.error(`[Storage] Error loading ${name}:`, error);
                                reject(error);
                            });
                    }
                })
            } else {
                // Try new chunked format first, then fallback to old format
                this.tryLoadNewFormat(slug)
                    .then(data => {
                        if (data) {
                            console.debug(`[Storage] Loaded ${name} using new chunked format`);
                            resolve(data);
                        } else {
                            console.debug(`[Storage] Falling back to old format for ${name}`);
                            this.getDataFromDB(slug, resolve, reject);
                        }
                    })
                    .catch(error => {
                        console.error(`[Storage] Error loading ${name}:`, error);
                        reject(error);
                    });
            }
        });
    }
}

export default Storage;