import { saveAs } from 'file-saver';


export function doesAContainsB(a, b) {
    if (a && b) {
        return a.getNorth() >= b.getNorth()
            && a.getSouth() <= b.getSouth()
            && a.getEast() >= b.getEast()
            && a.getWest() <= b.getWest();
    } else {
        return null;
    }
}

// Thanks https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
export function downloadObjectAsJson(data, fileName) {
    fileName += '.geojson';
    const blob = new Blob([JSON.stringify(data)], {
        type: 'application/geo+json',
        name: fileName
    }); 
    saveAs(blob, fileName);
}

export function createPolygonFromBBox(bbox) {
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [
                [
                    bbox.getNorthWest().toArray(),
                    bbox.getNorthEast().toArray(),
                    bbox.getSouthEast().toArray(),
                    bbox.getSouthWest().toArray(),
                    bbox.getNorthWest().toArray()
                ]
            ]
        }
    };
}

// Thanks https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
export function slugify(str) {
  const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·/_,:;'
  const b = 'aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return str.toString().toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with ‘and’
    .replace(/[^\w-]+/g, '') // Remove all non-word characters
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

const typeSizes = {
    "undefined": () => 0,
    "boolean": () => 4,
    "number": () => 8,
    "string": item => 2 * item.length,
    "object": item => !item ? 0 : Object
        .keys(item)
        .reduce((total, key) => sizeOf(key) + sizeOf(item[key]) + total, 0)
};

export const sizeOf = value => typeSizes[typeof value](value);

// Thanks https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
export function timeSince(date) {
    date = new Date(date);

    var seconds = Math.floor((new Date() - date) / 1000);

    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " anos";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " meses";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " dias";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " horas";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutos";
    }
    // return Math.floor(seconds) + " segundos";
    return " poucos segundos";
}

// Thanks https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
String.prototype.removeAccents = function() {
    return this.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}