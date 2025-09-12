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

    getFooter(osmUrl, color='black') {
        return `
            <!-- <div class="-ml-4 -mr-4 border border-b-0 border-${color} border-opacity-25 mt-10">
            </div> -->
            
            <div class="-mb-2 mt-10">
                <div class="opacity-25 mb-2 italic">
                    Acha que estes dados podem ser melhorados?
                </div>
                
                <a class="text-${color} border border-opacity-25 border-${color} px-2 py-1 rounded-xl mr-1"
                    target="_BLANK" rel="noopener"
                    href="${osmUrl}"
                >
                    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" class="react-icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>    
                    Editar no OSM
                </a>

                <a  href="#"
                    class="text-${color} border border-opacity-25 border-${color} px-2 py-1 rounded-xl"
                    onClick="document.dispatchEvent(new Event('newComment'));"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="react-icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H8L3 22V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15ZM13 14V11H16V9H13V6H11V9H8V11H11V14H13Z"></path></svg>
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

        let html = `
            <div class="text-2xl mt-3 mb-5">
                <img src="${iconSrc}" class="inline-block align-bottom mr-1" alt=""/>
                    ${properties.name
                        ? properties.name
                        : '<span class="italic opacity-50">Sem nome</span>'
                    }
            </div>

            <div class="mt-2 text-sm grid grid-cols-2 gap-2">
                ${Object.keys(properties).map(key => {
                    const translatedName = i18n[key];
                    const untranslatedValue = properties[key];
                    const translatedValue = i18n[untranslatedValue];

                    switch(key) {
                        case 'website':
                        case 'email':
                        case 'facebook':
                            // Sometimes people will not put the http part of the link on OSM,
                            // making the browser think the link is a subpage of CicloMapa and
                            // adding our domain to the beggining of it.
                            let link = untranslatedValue.includes('http') ? untranslatedValue : 'http://' + untranslatedValue;
                            return [
                                translatedName,
                                `<a target="_BLANK" rel="noopener"
                                    class="underline" href=${link}>
                                    Link</a>`
                            ];
                        
                        default: 
                            if (translatedName) {
                                return [
                                    translatedName,
                                    translatedValue || untranslatedValue
                                ];
                            } else {
                                console.debug('Ignored OSM tag:', key, untranslatedValue);
                                return '';
                            };
                    }
                })
                .map(i => i ? `
                    <div class="mt-2">
                        <div class="text-xs font-bold opacity-50">
                            ${i[0]}
                        </div>
                        <div>
                            ${i[1]}
                        </div>
                    </div>` : '')
                .join('')}
            </div>

            ${this.getFooter(osmUrl, 'white')}
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

        let debugPropsStr = '';
        if (this.debugMode) {
            debugPropsStr = `
                <div class="mt-2 text-sm grid grid-cols-2 gap-2">
                    ${Object.keys(properties).map(key => key ? `
                        <div class="mt-2">
                            <div class="text-xs font-bold opacity-50">
                                ${key.includes('ciclomapa') ? key.split('ciclomapa:')[1] : key}
                            </div>
                            <div>
                                ${typeof properties[key] === 'number' && !Number.isInteger(properties[key]) 
                                    ? properties[key].toFixed(1) 
                                    : (properties[key] || '')}
                            </div>
                        </div>` : '')
                    .join('')}
                </div>`;
        }

        let html = `
            <div class="text-black">
                <div class="text-2xl mt-3 mb-5">
                    ${properties.name ?
                        properties.name :
                        '<span class="italic opacity-50">Via sem nome</span>'}
                </div>

                <div
                    class="inline-block py-1 px-3 rounded-full bg-black font-bold"
                    style="color: ${layer.style.lineColor}"
                >
                    ${layer.name}
                </div>

                ${debugPropsStr}

                ${this.getFooter(osmUrl)}
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
}

export default MapPopups;