import { get, set } from 'idb-keyval';

import firebase from 'firebase';

import { slugify, sizeOf } from './utils.js'

import pako from 'pako';


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
    
    constructor() {
        firebase.initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId
        });

        this.db = firebase.firestore();

        this.db.collection("cities").get().then((querySnapshot) => {
            console.log('[Firestore] Documents found:');
            querySnapshot.forEach((doc) => {
                console.debug('• ' + doc.id);
            });
        });
    }

    compressJson(data) {
        console.log('Before: ', sizeOf(data));
        
        // // Minimize size by cleaning clearing OSM tags
        // data.features.forEach(feature => {
        //     Object.keys(feature.properties).forEach(propertyKey => {
        //         if (propertyKey !== 'id' &&
        //             propertyKey !== 'name' &&
        //             propertyKey !== 'type')
        //             delete feature.properties[propertyKey];
        //     });
        // });

        // Compress with gzip
        const compressed = pako.deflate(JSON.stringify(data), { to: 'string' });

        console.log('After: ', sizeOf(compressed));

        // test
        // const decompressed = JSON.parse(pako.inflate(compressed), { to: 'string' });
        // console.log(decompressed);

        return compressed;
    }

    save(name, geoJson, updatedAt) {
        const slug = slugify(name);

        // Save to Local Storage
        set(name, {
            geoJson: geoJson,
            updatedAt: updatedAt
        });

        // Save to Firestore
        try {
            // geoJson = this.compressJson(geoJson);

            this.db.collection('cities').doc(slug).set({
                name: name,
                geoJson: JSON.stringify(geoJson),
                updatedAt: updatedAt
            }).then(() => {
                console.debug("[Firebase] Document written successfully.");
            }).catch(error => {
                console.error("[Firebase] Error adding document: ", error);
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
                // data.geoJson = JSON.parse(pako.inflate(data.geoJson), { to: 'string' });

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