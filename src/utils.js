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

export function formatTimeAgo(dateInput, options = {}) {
    const { locale = 'pt-BR', capitalizeFirstLetter = false } = options;
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    let formatted;

    if (Math.abs(diffInSeconds) < 60) {
        formatted = rtf.format(diffInSeconds, 'second');
    } else {
        const diffInMinutes = Math.round(diffInSeconds / 60);
        if (Math.abs(diffInMinutes) < 60) {
            formatted = rtf.format(diffInMinutes, 'minute');
        } else {
            const diffInHours = Math.round(diffInMinutes / 60);
            if (Math.abs(diffInHours) < 24) {
                formatted = rtf.format(diffInHours, 'hour');
            } else {
                const diffInDays = Math.round(diffInHours / 24);
                if (Math.abs(diffInDays) < 30) {
                    formatted = rtf.format(diffInDays, 'day');
                } else {
                    const diffInMonths = Math.round(diffInDays / 30);
                    if (Math.abs(diffInMonths) < 12) {
                        formatted = rtf.format(diffInMonths, 'month');
                    } else {
                        const diffInYears = Math.round(diffInMonths / 12);
                        formatted = rtf.format(diffInYears, 'year');
                    }
                }
            }
        }
    }

    if (!capitalizeFirstLetter || !formatted) {
        return formatted;
    }

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

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

// Helper function to convert hex color to rgba with alpha
export function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to convert RGB to HSL
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return [h * 360, s, l];
}

// Helper function to convert HSL to RGB
function hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

// Adjust HEX color brightness by a percentage (-1 to 1)
// Positive values brighten, negative values darken
// method: 'linear' (default) or 'hsl' for different adjustment techniques
export function adjustColorBrightness(hexColor, percentage = 0.3, method = 'linear') {
    // If percentage is 0, return the original color unchanged
    if (percentage === 0) {
        // Ensure it has # prefix for consistency
        return hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
    }
    
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    let newR, newG, newB;
    
    if (method === 'hsl') {
        // HSL-based adjustment: adjusts lightness while preserving hue and saturation
        const [h, s, l] = rgbToHsl(r, g, b);
        let newL;
        
        if (percentage > 0) {
            // Brighten by increasing lightness
            newL = Math.min(1, l + percentage);
        } else {
            // Darken by decreasing lightness
            newL = Math.max(0, l * (1 + percentage));
        }
        
        const rgb = hslToRgb(h, s, newL);
        newR = rgb[0];
        newG = rgb[1];
        newB = rgb[2];
    } else {
        // Default linear method
        if (percentage > 0) {
            // Brighten by moving towards white (255, 255, 255)
            newR = Math.round(r + (255 - r) * percentage);
            newG = Math.round(g + (255 - g) * percentage);
            newB = Math.round(b + (255 - b) * percentage);
        } else {
            // Darken by moving towards black (0, 0, 0)
            newR = Math.round(r * (1 + percentage));
            newG = Math.round(g * (1 + percentage));
            newB = Math.round(b * (1 + percentage));
        }
    }
    
    // Clamp values to valid RGB range
    newR = Math.max(0, Math.min(255, newR));
    newG = Math.max(0, Math.min(255, newG));
    newB = Math.max(0, Math.min(255, newB));
    
    // Convert back to HEX
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

// Generate OSM editor URL with proper zoom compensation
export function getOsmUrl(lat, lng, zoom) {
    // Compensate different zoom levels from Mapbox to OSM Editor
    zoom = Math.ceil(zoom) + 1;

    return `https://www.openstreetmap.org/edit#map=${zoom}/${lat}/${lng}`;
}