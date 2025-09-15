import mapboxgl from 'mapbox-gl'

import './MapPopups.css'
import { osmi18n as i18n } from './osmi18n.js'
import Analytics from './Analytics.js'
import { getRouteScore, formatDistance, formatDuration } from './routeUtils.js'

import { IS_MOBILE } from "./constants.js";


class MapPopups {
    map;

    popup;
    commentPopup;
    poiPopup;
    routeTooltips;
    previousCyclewayLayerClass;

    constructor(map, debugMode) {
        this.map = map;
        this.debugMode = debugMode;

        // "closeOnClick: false" enables chaining clicks continually
        //   from POI to POI, otherwise clicking on another POI would
        //   just close the popup from the previous one.
        this.cyclewayPopup = new mapboxgl.Popup({
            className: 'popup-big',
            closeOnClick: IS_MOBILE,
        });
        this.cyclewayPopup.on('close', e => {
            if (this.selectedCycleway) {
                this.map.setFeatureState({ source: 'osm', id: this.selectedCycleway }, { hover: false });
            }
            this.selectedCycleway = null;
        });

        this.commentPopup = new mapboxgl.Popup({
            className: 'popup-big',
            closeOnClick: IS_MOBILE,
            offset: 25
        });

        this.poiPopup = new mapboxgl.Popup({
            className: 'popup-big',
            closeOnClick: IS_MOBILE,
            offset: 25
        });

        this.routeTooltips = [];
    }

    renderProperties(properties) {
        const propertiesHtml = Object.keys(properties)
            .filter(key => this.debugMode ? true : !key.startsWith('ciclomapa:'))
            .map(key => {
                const untranslatedValue = properties[key];
                const translatedName = i18n[key];
                const translatedValue = i18n[untranslatedValue];

                let content = '';
                let isTranslated = true;

                switch(key) {
                    case 'website':
                    case 'email':
                    case 'facebook':
                        // Sometimes people will not put the http part of the link on OSM,
                        // making the browser think the link is a subpage of CicloMapa and
                        // adding our domain to the beggining of it.
                        let link = untranslatedValue.includes('http') ? untranslatedValue : 'http://' + untranslatedValue;
                        content = `<a target="_BLANK" rel="noopener" class="underline" href=${link}>${link}</a>`;
                        break;
                    
                    default: 
                        if (translatedName) {
                            content = translatedValue || untranslatedValue;
                        } else {
                            if (this.debugMode) {
                                // In debug mode, show untranslated properties
                                content = untranslatedValue;
                                isTranslated = false;
                            } else {
                                console.debug('Map tooltip: ignored OSM tag:', key, untranslatedValue);
                                return '';
                            }
                        };
                        break;
                }

                const labelColor = this.debugMode && !isTranslated ? 'text-red-500' : 'opacity-70';
                const displayName = translatedName || key;

                return `
                    <div class="mt-2">
                        <div class="font-bold ${labelColor}">
                            ${displayName}
                        </div>
                        <div class="overflow-ellipsis overflow-hidden">
                            ${content}
                        </div>
                    </div>`;
            }).join('');

        return `
            <div class="mt-2 text-sm grid grid-cols-2 gap-2">
                ${propertiesHtml}
            </div>`;
    }

    getFooter(osmUrl, color='black', coordinates = null) {
        return `
            <div class="-mb-6 -mx-4 mt-10 p-4 pt-4 rounded-bl-lg rounded-br-lg" style="background-color: rgba(0,0,0,0.04)">
                ${coordinates && `
                    <button class="text-${color} border border-opacity-25 border-${color} px-2 py-0.5 rounded-xl mr-1"
                        onclick="window.setDestinationFromPopup && window.setDestinationFromPopup(${JSON.stringify(coordinates)})"
                    >
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-0.5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.62515 0.569498C5.38448 -0.189833 6.61582 -0.189833 7.37515 0.569498L11.4308 4.62516C12.19 5.38451 12.1901 6.61589 11.4308 7.37516L7.37515 11.4308C6.61588 12.1901 5.38449 12.19 4.62515 11.4308L0.569489 7.37516C-0.189836 6.61584 -0.189824 5.38449 0.569489 4.62516L4.62515 0.569498ZM7.00015 5.00016H4.50015C3.67173 5.00016 3.00015 5.67173 3.00015 6.50016V8.00016H4.00015V6.50016C4.00015 6.22402 4.22401 6.00016 4.50015 6.00016H7.00015V8.65153L9.10074 5.50016L7.00015 2.34879V5.00016Z"/></svg>
                        Como chegar
                    </button>
                ` || ''}

                <a class="text-${color} border border-opacity-25 border-${color} px-2 py-1 rounded-xl mr-1"
                    target="_BLANK" rel="noopener"
                    href="${osmUrl}"
                >
                    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-0.5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M1 8.91695V11H3.08304L8.91638 5.16667L6.83333 3.08362L1 8.91695ZM10.8375 3.24552C11.0542 3.02888 11.0542 2.67893 10.8375 2.4623L9.5377 1.16248C9.32107 0.945841 8.97111 0.945841 8.75448 1.16248L7.73795 2.179L9.821 4.26205L10.8375 3.24552Z"/></svg>    
                    Editar no OSM
                </a>

                <a  href="#"
                    class="text-${color} border border-opacity-25 border-${color} px-2 py-1 rounded-xl"
                    onClick="document.dispatchEvent(new Event('newComment'));"
                >
                    <svg fill="currentColor" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-0.5"><path d="M10.3887 0.677734C10.6833 0.677734 10.9664 0.793706 11.1748 1C11.383 1.20617 11.4999 1.48584 11.5 1.77734V7.40039C11.4999 7.69189 11.383 7.97154 11.1748 8.17773C10.9664 8.38404 10.6833 8.5 10.3887 8.5H4.27734L3.16699 10.9004L1.5 12V1.77734C1.50013 1.48583 1.61701 1.20617 1.8252 1C2.03357 0.793706 2.31664 0.677734 2.61133 0.677734H10.3887ZM6 2V4H4V5H6V7H7V5H9V4H7V2H6Z"/></svg>
                    Comentar
                </a>
            </div>
        `;
    }

    showCommentPopup(e) {
        const coords = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;

        let html = `
            <div style="color: gray;">
                ${new Date(properties.createdAt).toLocaleString('pt-br')}
            </div>

            <div style="
                margin-top: 1em;
                font-size: 18px;">
                ${properties.text}
            </div>
        `;

        if (properties.tags) {
            // Arrays and objects get serialized by Mapbox system
            properties.tags = JSON.parse(properties.tags);

            html += `
                <div style="
                    margin-top: 2em;
                    font-size: 14px;
                    font
                ">
            `;
            
            properties.tags.forEach( t => {
                html += `
                    <div class="inline-block py-1 px-3 rounded-full border-gray-700 border mt-2 text-xs">
                        ${t}
                    </div>
                `;
            })
            
            html += `</div>`;
        }

        this.commentPopup.setLngLat(coords)
            .setHTML(html)
            .addTo(this.map);
    }

    showPOIPopup(e, iconSrc, poiType) {
        // const coords = e.features[0].geometry.coordinates.slice();
        const coords = e.lngLat;
        const properties = e.features[0].properties;
        const osmUrl = `https://www.openstreetmap.org/${properties.id}`;

        console.debug(properties);

        // Special address collapse case
        const addrStreet = properties['addr:street'];
        const addrNbr = properties['addr:housenumber'];
        if (addrStreet && addrNbr) {
            properties['ciclomapa:address'] = `${addrStreet}, ${addrNbr}`;
            delete properties['addr:street'];
            delete properties['addr:housenumber'];
        }

        const poiTypeMap = {
            "poi-bikeshop": "Oficina/loja (sem nome)",
            "poi-rental": "Estação de bicicleta (sem nome)",
            "poi-bikeparking": "Bicicletário/paraciclo"
        };

        let html = `
            <div class="text-2xl mt-3 mb-5">
                <img src="${iconSrc}" class="inline-block align-bottom mr-1" alt=""/>
                    ${properties.name
                        ? properties.name
                        : `<span class="italic opacity-50">${poiTypeMap[poiType]} </span>`
                    }
            </div>

            ${this.renderProperties(properties)}

            ${this.getFooter(osmUrl, 'white', [coords.lng, coords.lat])}
        `;

        this.poiPopup.setLngLat(coords)
            .setHTML(html)
            .addTo(this.map);

            Analytics.event('view_item', {
                items: [{
                    item_name : `${poiType} - ${properties.name}`,
                    item_variant: poiType,
                    item_category: 'map data'
                }],
            });
    }

    showCyclewayPopup(e, layer) {
        const coords = e.lngLat;
        const properties = e.features[0].properties;
        const osmUrl = `https://www.openstreetmap.org/${properties.id}`;
        const bgClass = layer.id;
        
        if (this.previousCyclewayLayerClass) {
            this.cyclewayPopup.removeClassName(this.previousCyclewayLayerClass);
        }
        this.previousCyclewayLayerClass = bgClass;


        let html = `
            <div class="text-black">
                <div class="relative inline-block mt-3 group">
                    <div
                        class="inline-flex items-center py-0 px-2 rounded-full bg-black font-semibold tracking-wide cursor-pointer"
                        style="color: ${layer.style.lineColor}"
                    >
                        ${layer.name}
                    </div>
                    ${layer.description ? `
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-normal rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 z-10">
                            ${layer.description}
                            <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                    ` : ''}
                </div>

                <div class="text-2xl mt-2 mb-5 tracking-tight">
                    ${properties.name ?
                        properties.name :
                        '<span class="italic opacity-50">Via sem nome</span>'}
                </div>

                ${this.renderProperties(properties)}

                ${this.getFooter(osmUrl, 'black', [coords.lng, coords.lat])}
            </div>
        `;

        this.cyclewayPopup
            .setLngLat(coords)
            .setHTML(html)
            .addTo(this.map);
        this.cyclewayPopup.addClassName(bgClass); 

        Analytics.event('view_item', {
            items: [{
                item_name : `${layer.name} - ${properties.name}`,
                item_variant: layer.name,
                item_category: 'map data'
            }],
        });
    }

    hidePopup() {
        this.cyclewayPopup.removeClassName(this.previousCyclewayLayerClass);
        this.previousCyclewayLayerClass = null;

        this.cyclewayPopup.remove();
    }

    // Route tooltip methods
    createRouteTooltipHTML(route, routeIndex, routeCoverageData, selectedRouteIndex = null) {
        const { score: routeScore, cssClass: routeScoreClass } = getRouteScore(routeCoverageData, routeIndex);
        const stateClass = this.getTooltipStateClass(routeIndex, selectedRouteIndex);
        
        const baseClasses = "px-2 py-1 text-xs bg-black rounded-md font-medium shadow-lg cursor-pointer transition-all duration-200 max-w-[200px]";
        
        return `
            <div class="route-tooltip-content ${stateClass}">
                <div class="${baseClasses} text-white" data-route-index="${routeIndex}">
                    <div class="flex items-center space-x-2">
                        ${routeScore !== null ? `
                            <div class="${routeScoreClass} text-black px-1 py-0.5 rounded text-xs font-mono">
                                ${routeScore}
                            </div>
                        ` : ''}
                        <div class="flex flex-col">
                            <span class="font-semibold">${formatDistance(route.distance)}</span>
                            <span class="text-gray-500">${formatDuration(route.duration)}</span>
                            ${route.provider ? `<span class="text-xs text-gray-600 font-mono">${route.provider}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTooltipStateClass(routeIndex, selectedRouteIndex) {
        if (selectedRouteIndex === routeIndex) return '';
        if (selectedRouteIndex !== null) return 'opacity-70 hover:opacity-100 ';
        return '';
    }

    updateRouteTooltips(directions, routeCoverageData, onRouteSelected, selectedRouteIndex = null) {
        // Clear existing route tooltips
        this.clearRouteTooltips();

        if (directions && directions.routes && directions.routes.length > 0) {
            directions.routes.forEach((route) => {
                if (!route.geometry || route.geometry.type !== 'LineString') {
                    return;
                }

                console.debug('updateRouteTooltips - route', route, route.sortedIndex);

                // Calculate midpoint of the route
                const coordinates = route.geometry.coordinates;
                const percentageSlot = (route.sortedIndex + 1) / (directions.routes.length + 1);
                const midPoint = coordinates[Math.floor(coordinates.length * percentageSlot)];

                // Create popup for this route
                const popup = new mapboxgl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    closeOnMove: false,
                    className: 'route-tooltip-popup'
                })
                .setLngLat(midPoint)
                .setHTML(this.createRouteTooltipHTML(route, route.sortedIndex, routeCoverageData, selectedRouteIndex))
                .addTo(this.map);

                // Add click handler to the popup content
                popup.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (onRouteSelected) {
                        onRouteSelected(route.sortedIndex);
                    }
                });

                // Store popup reference for cleanup
                this.routeTooltips.push(popup);
            });

            // Update tooltip states after creation
            this.updateTooltipStates(selectedRouteIndex);
        }
    }

    updateTooltipStates(selectedRouteIndex) {
        if (!this.routeTooltips) return;

        this.routeTooltips.forEach((popup, index) => {
            const contentDiv = popup.getElement()?.querySelector('.route-tooltip-content');
            if (contentDiv) {
                contentDiv.className = `route-tooltip-content ${this.getTooltipStateClass(index, selectedRouteIndex)}`;
            }
        });
    }

    updateTooltipSelectedState(selectedRouteIndex) {
        this.updateTooltipStates(selectedRouteIndex);
    }

    clearRouteTooltips() {
        this.routeTooltips.forEach(popup => popup.remove());
        this.routeTooltips = [];
    }

    closeAllPopups() {
        this.cyclewayPopup.remove();
        this.commentPopup.remove();
        this.poiPopup.remove();
    }
}

export default MapPopups;