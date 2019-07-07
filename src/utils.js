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
export function downloadObjectAsJson(exportObj, exportName) {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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