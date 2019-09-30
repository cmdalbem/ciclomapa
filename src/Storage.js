import { get, set } from 'idb-keyval';

import firebase from 'firebase';

import { slugify, sizeOf } from './utils.js'
import { cleanUpOSMTags, gzipCompress } from './geojsonUtils.js'


const DISABLE_LOCAL_STORAGE = true;

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
    buffer;
    
    constructor() {
        firebase.initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId
        });

        this.db = firebase.firestore();

        this.db.collection("cities").get().then((querySnapshot) => {
            console.debug('[Firestore] Documents found:');
            querySnapshot.forEach((doc) => {
                console.debug('• ' + doc.id);
            });
        });
    }

    compressJson(data) {
        console.debug('Before: ', sizeOf(data));

        // Minimize size by cleaning clearing OSM tags
        // @todo DOESNT WORK because Mapbox needs the OSM tags to render the layers
        // cleanUpOSMTags(data);
        
        // Compress with gzip
        const compressed = gzipCompress(data);

        console.debug('After: ', sizeOf(compressed));

        return compressed;
    }

    saveToFirestore(name, jsonStr, updatedAt, part) {
        let slug = slugify(name);

        if (part === 2) {
            slug += 2;
        }

        return this.db.collection('cities').doc(slug).set({
            name: name,
            geoJson: jsonStr,
            updatedAt: updatedAt,
            part: part || ''
        });
    }

    save(name, geoJson, updatedAt) {
        // Save to Local Storage
        set(name, {
            geoJson: geoJson,
            updatedAt: updatedAt
        });

        // Save to Firestore
        try {
            const jsonStr = JSON.stringify(geoJson);

            // geoJson = this.compressJson(geoJson);
            this.saveToFirestore(name, jsonStr, updatedAt)
                .then(() => {
                    console.debug("[Firebase] Document written successfully.");
                }).catch(error => {
                    // console.error("[Firebase] Error adding document: ", error);
                    console.debug('[Firestore] Failed saving full data, splitting in 2...')

                    const part1 = jsonStr.slice(0, Math.ceil(jsonStr.length/2));
                    const part2 = jsonStr.slice(Math.ceil(jsonStr.length/2));

                    this.saveToFirestore(name, part1, updatedAt, 1) 
                    .then(() => {
                        console.debug("[Firebase] Document written successfully.");
                    }).catch(error => {
                        console.error("[Firebase] Error adding document: ", error);
                    });        
 
                    this.saveToFirestore(name, part2, updatedAt, 2)
                    .then(() => {
                        console.debug("[Firebase] Document written successfully.");
                    }).catch(error => {
                        console.error("[Firebase] Error adding document: ", error);
                    });        

                });
        } catch (e) {
            console.error(e);
        }
    }

    getDataFromDB(slug, resolve, reject) {
        this.db.collection("cities").doc(slug).get().then(doc => {
            if (doc.exists) {
                let data = doc.data();

                console.debug("[Firebase] Document data:", data);

                // Decompress gzip
                // data.geoJson = gzipDecompress(data.geoJson)

                if (data.part === 1) {
                    this.buffer = data.geoJson; 
                    return this.getDataFromDB(slug + '2', resolve, reject);
                } else if (data.part === 2) {
                    data.geoJson = this.buffer + data.geoJson;
                }

                // Massage data
                data.geoJson = JSON.parse(data.geoJson);
                data.updatedAt = data.updatedAt.toDate();

                resolve(data);
            } else {
                console.debug("[Firebase] No document for: ", slug);
                resolve();
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