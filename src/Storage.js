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

            // Save to Firestore
            try {
                const compressed = this.compressJson(geoJson);

                // Save calculated lengths
                // @todo: add updatedAt field
                console.debug(`[Firebase] Saving lengths for ${name}...`, lengths);
                this.saveStatsToFirestore(name, lengths)
                    .then(() => {
                        console.debug(`[Firebase] Lengths for ${name} saved successfully.`);
                    })
                    .catch(error => {
                        console.error("[Firebase] Error saving lengths: ", error);
                        reject();
                    });  

                // Save GeoJSON data
                // 
                // @todo This looks horrible, I know. Here's how it could be improved:
                //   - Better estimate package size and compare with Firestore limitations;
                //   - Rewrite function to be generic (prob. a recursive approach is a good idea);
                //   - Migrate storage to use other product or technology with less limitations.
                // 
                console.debug(`[Firebase] Saving GeoJSON ${name}...`, geoJson);
                this.saveGeoJSONToFirestore(name, compressed, lengths)
                    .then(() => {
                        console.debug(`[Firebase] GeoJSON ${name} saved successfully.`);
                        resolve();
                    }).catch(error => {
                        console.debug('[Firestore] Failed to save GeoJSON in 1 part, splitting in 2...')

                        const part1 = compressed.slice(0, Math.ceil(compressed.length/2));
                        const part2 = compressed.slice(Math.ceil(compressed.length/2));

                        this.saveGeoJSONToFirestore(name, part1, lengths, 1) 
                        .then(() => {
                            console.debug(`[Firebase] GeoJSON ${name} (1/2) saved successfully.`);

                            this.saveGeoJSONToFirestore(name, part2, lengths, 2)
                            .then(() => {
                                console.debug(`[Firebase] GeoJSON ${name} (2/2) saved successfully.`);
                                resolve();
                            }).catch(error => {
                                console.error(`[Firebase] Error saving GeoJSON ${name} (2/2): `, error);
                                reject();
                            });
                        }).catch(error => {
                            console.debug('[Firestore] Failed to save GeoJSON in 2 parts, splitting in 3...')
                            
                            const divider = Math.ceil(compressed.length/3);
                            const partb1 = compressed.slice(0, divider);
                            const partb2 = compressed.slice(divider, divider*2);
                            const partb3 = compressed.slice(divider*2, divider*3);

                            this.saveGeoJSONToFirestore(name, partb1, lengths, 1) 
                            .then(() => {
                                console.debug(`[Firebase] GeoJSON ${name} (1/3) saved successfully.`);

                                this.saveGeoJSONToFirestore(name, partb2, lengths, 2)
                                .then(() => {
                                    console.debug(`[Firebase] GeoJSON ${name} (2/3) saved successfully.`);
                                    
                                    this.saveGeoJSONToFirestore(name, partb3, lengths, 3)
                                    .then(() => {
                                        console.debug(`[Firebase] GeoJSON ${name} (3/3) saved successfully.`);
                                        resolve();
                                    }).catch(error => {
                                        console.error(`[Firebase] Error saving GeoJSON ${name} (3/3): `, error);
                                        reject();
                                    });
                                }).catch(error => {
                                    console.error(`[Firebase] Error saving GeoJSON ${name} (2/3): `, error);
                                    reject();
                                });
                            }).catch(error => {
                                console.error(`[Firebase] Error saving GeoJSON ${name} (1/3): `, error);
                                reject();
                            });   
                        });        
                    });
            } catch (e) {
                console.error(e);
                reject();
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

    getDataFromDB(slug, resolve, reject, part) {
        const slugWithPart = slug + (part ? part : '');
        this.db.collection(DEFAULT_CITIES_COLLECTION).doc(slugWithPart).get().then(doc => {
            if (doc.exists) {
                let data = doc.data();

                console.debug("[Firebase] Document data:", data);

                if (!data.part || data.part === 1) {
                    // Recursion iteration 0
                    this.dataBuffer = {};
                    this.dataBuffer.geoJson = data.geoJson; 
                    this.dataBuffer.updatedAt = data.updatedAt; 
                    return this.getDataFromDB(slug, resolve, reject, 2);
                } else if (data.part >= 2) {
                    // Recursion iteration n
                    this.dataBuffer.geoJson += data.geoJson;
                    return this.getDataFromDB(slug, resolve, reject, data.part+1);
                }
            } else {
                console.debug("[Firebase] No document for: ", slug);

                // Check if recursion tail
                if (!!part) {
                    let ret = {};
                    ret.updatedAt = this.dataBuffer.updatedAt.toDate();
    
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
            reject();
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
                        this.getDataFromDB(slug, resolve, reject);
                    }
                })
            } else {
                this.getDataFromDB(slug, resolve, reject);
            }
        });
    }
}

export default Storage;