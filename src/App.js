import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

import { get, set } from 'idb-keyval';

import { notification } from 'antd';
import "antd/dist/antd.css";

import Map from './Map.js'
import Spinner from './Spinner.js'
import TopBar from './TopBar.js'
import MapStyleSwitcher from './MapStyleSwitcher.js'
import LayersPanel from './LayersPanel.js'
import OSMController from './OSMController.js'
import { DEFAULT_LAT, DEFAULT_LNG, OSM_DATA_MAX_AGE_MS } from './constants.js'
import { downloadObjectAsJson } from './utils.js'

import './App.css';

class App extends Component {
    geoJson;

    constructor(props) {
        super(props);

        this.updateData = this.updateData.bind(this);
        this.onMapStyleChange = this.onMapStyleChange.bind(this);
        this.onMapMoved = this.onMapMoved.bind(this);
        this.onLayersChange = this.onLayersChange.bind(this);
        this.downloadData = this.downloadData.bind(this);

        const urlParams = this.getParamsFromURL();
        this.state = {
            geoJson: null,
            loading: false,
            layers: OSMController.getLayers(),
            mapStyle: 'mapbox://styles/cmdalbem/cjgmxgkbw000n2rqtucat5zjz',
            zoom: urlParams.z || 13,
            area: '',
            center: [
                parseFloat(urlParams.lng) || DEFAULT_LNG,
                parseFloat(urlParams.lat) || DEFAULT_LAT]
        };

        if (this.state.area) {
            this.updateData();
        }
    }

    getParamsFromURL() {
        const possibleParams = ['z', 'lat', 'lng'];
        const urlParams = new URLSearchParams(this.props.location.search);
        let paramsObj = {}

        possibleParams.forEach( p => {
            let value = urlParams.get(p);
            if (value) {
                paramsObj[p] = value;
            }
        })

        return paramsObj;
    }

    isDataFresh(data) {
        const now = new Date();
        const dataLastUpdate = new Date(data.updatedAt);

        return now - dataLastUpdate < OSM_DATA_MAX_AGE_MS;
    }

    updateData() {
        // if (this.state.zoom > MIN_ZOOM_TO_LOAD_DATA && this.state.area) {
        if (this.state.area) {
            // Try to retrieve previously saved data for this area
            get(this.state.area)
                .then(data => {
                    console.debug('IndexedDB result:', data);
                    
                    if (data && this.isDataFresh(data)) {
                        console.debug('IndexedDB data is fresh.');
                        this.setState({
                            geoJson: data.geoJson,
                            dataUpdatedAt: new Date(data.updatedAt)
                        });
                    } else { 
                        console.debug(`Couldn't find data for area ${this.state.area} or it isn't fresh, hitting OSM...`);
                        this.setState({ loading: true });

                        OSMController.getData({ area: this.state.area })
                            .then(data => {
                                const now = new Date();

                                set(this.state.area, {
                                    geoJson: data.geoJson,
                                    updatedAt: now
                                });

                                this.setState({
                                    geoJson: data.geoJson,
                                    loading: false,
                                    dataUpdatedAt: now
                                });
                            })
                            .catch(e => {
                                this.setState({
                                    error: true
                                });
                            });
                    }
                })
                .catch(e => {
                    notification['error']({
                        message: 'Erro',
                        description:
                            'Ocorreu um erro ao tentar recuperar os dados salvos no IndexedDB.',
                    });
                });
        } else {
            this.setState({ loading: false });
        }
    }

    onMapStyleChange(newMapStyle) {
        this.setState({ mapStyle: newMapStyle});
    }

    onLayersChange(id, newVal) {
        let newLayers = Object.assign([], this.state.layers);
        let modifiedLayer = newLayers.filter(l => l.id === id)[0];
        modifiedLayer.isActive = newVal;

        this.setState({ layers: newLayers });
    }

    downloadData() {
        // Fill out typologies
        this.state.geoJson.features.forEach( feature => {
            this.state.layers.forEach( layer => {
                layer.filters.forEach( filter => {
                    Object.keys(feature.properties).forEach(propertyKey => {
                        // console.debug(propertyKey, filter[0]);
                        // console.debug(feature.properties[propertyKey], filter[1]);
                        if ((typeof filter[0] === 'object'
                            &&
                             (propertyKey === filter[0][0] &&
                              feature.properties[propertyKey] === filter[0][1]) ||
                             (propertyKey === filter[1][0] &&
                              feature.properties[propertyKey] === filter[1][1]))
                            ||
                            (propertyKey === filter[0] &&
                             feature.properties[propertyKey] === filter[1]))
                        {
                            feature.properties['type'] = layer.name;
                            // console.debug(feature.properties.id + ' ' + feature.properties.name, layer.name);
                        } 
                    });
                })
            });
        });

        // Delete unwanted OSM properties
        this.state.geoJson.features.forEach(feature => {
            Object.keys(feature.properties).forEach(propertyKey => {
                if (propertyKey !== 'id' &&
                    propertyKey !== 'name' &&
                    propertyKey !== 'type')
                    delete feature.properties[propertyKey];
            });
        });
        
        downloadObjectAsJson(this.state.geoJson, `mapa-cicloviario-${this.state.area}`);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.location !== prevProps.location) {
            this.onRouteChanged();
        }

        if (this.state.area !== prevState.area) {
            console.debug(`Changed area from ${prevState.area} to ${this.state.area}`);
            
            this.updateData();

            // Only redo the query if we need new data
            // if (!doesAContainsB(largestBoundsYet, newBounds)) {
            //     this.updateData();
            //     largestBoundsYet = newBounds;

            //     if (DEBUG_BOUNDS_OPTIMIZATION) {
            //         this.updateDebugPolygon(largestBoundsYet, 1);
            //     }
            // }
        }
        
        if (this.state.zoom !== prevState.zoom ||
            this.state.lat !== prevState.lat ||
            this.state.lng !== prevState.lng) {
                let params = '?';
                params += `lat=${this.state.lat.toFixed(7)}`;
                params += `&lng=${this.state.lng.toFixed(7)}`;
                params += `&z=${this.state.zoom.toFixed(2)}`;
                this.props.history.push({
                    search: params
                })
        }
    }

    onRouteChanged() {
        // @todo Fix infinite loop
        // this.setState(this.getParamsFromURL());
    }

    onMapMoved(newState) {
        // Ignore new area changes from Map
        // if (this.state.area) {
        //     delete newState.area;
        // }

        this.setState(newState);
    }

    render() {
        return (
            <div>
                <TopBar
                    title={this.state.area}
                    lastUpdate={this.state.dataUpdatedAt}
                    downloadData={this.downloadData}
                    onMapMoved={this.onMapMoved}
                />

                <Map
                    data={this.state.geoJson}
                    layers={this.state.layers}
                    style={this.state.mapStyle}
                    zoom={this.state.zoom}
                    center={this.state.center}
                    updateData={this.updateData}
                    onMapMoved={this.onMapMoved}
                />

                <MapStyleSwitcher onMapStyleChange={this.onMapStyleChange}/>
 
                <LayersPanel
                    layers={this.state.layers}
                    onLayersChange={this.onLayersChange}
                />

                {
                    this.state.loading &&
                    <Spinner area={this.state.area} error={this.state.error}/>
                }
            </div>
        );
    }
}

export default withRouter(App);
