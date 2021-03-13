import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

import { notification } from 'antd';

import Analytics from './Analytics.js'

import Map from './Map.js'
import Spinner from './Spinner.js'
import CitySwitcherBackdrop from './CitySwitcherBackdrop.js'
import TopBar from './TopBar.js'
import MapStyleSwitcher from './MapStyleSwitcher.js'
import LayersPanel from './LayersPanel.js'
import AnalyticsSidebar from './AnalyticsSidebar.js'
import OSMController from './OSMController.js'
import Storage from './Storage.js'
import { downloadObjectAsJson } from './utils.js'
import { computeTypologies, cleanUpOSMTags, calculateLayersLengths } from './geojsonUtils.js'
import {
    DEFAULT_LAT,
    DEFAULT_LNG,
    DEFAULT_ZOOM,
    OSM_DATA_MAX_AGE_MS,
    DEFAULT_MAPBOX_STYLE,
    SAVE_TO_FIREBASE,
    DISABLE_DATA_HEALTY_TEST,
    IS_PROD,
    THRESHOLD_NEW_VS_OLD_DATA_TOLERANCE,
} from './constants.js'

// import './App.css';
import './App.less';

class App extends Component {
    geoJson;
    storage = new Storage();
    osmController = OSMController;

    constructor(props) {
        super(props);

        this.updateData = this.updateData.bind(this);
        this.onMapStyleChange = this.onMapStyleChange.bind(this);
        this.onMapShowSatelliteChanged = this.onMapShowSatelliteChanged.bind(this);
        this.onMapMoved = this.onMapMoved.bind(this);
        this.onLayersChange = this.onLayersChange.bind(this);
        this.downloadData = this.downloadData.bind(this);
        this.forceUpdate = this.forceUpdate.bind(this);
        this.onSpinnerClose = this.onSpinnerClose.bind(this);
        this.toggleSidebar = this.toggleSidebar.bind(this);

        const prev = this.getStateFromLocalStorage();

        const urlParams = this.getParamsFromURL();
        this.state = {
            area: (prev && prev.area) || '',
            showSatellite: (prev && prev.showSatellite) || false,
            zoom: (prev && prev.zoom) || urlParams.z || DEFAULT_ZOOM,
            center: [
                (prev && prev.lng) || parseFloat(urlParams.lng) || DEFAULT_LNG,
                (prev && prev.lat) || parseFloat(urlParams.lat) || DEFAULT_LAT],
            geoJson: null,
            loading: false,
            mapStyle: DEFAULT_MAPBOX_STYLE,
            layers: this.initLayers(prev && prev.layersStates),
            lengths: {},
            isSidebarOpen: true,
        };

        if (this.state.area) {
            this.updateData();
        }

        window.addEventListener('beforeunload', e => {
            this.saveStateToLocalStorage();
        });
    }

    toggleSidebar(state) {
        this.setState({isSidebarOpen: state});
    }

    initLayers(layersStates) {
        const layers = OSMController.getLayers();

        // Merge with locally saved state
        if (layersStates && Object.keys(layersStates).length > 0) {
            layers.forEach(l => {
                if (layersStates[l.id]) {
                    l.isActive = layersStates[l.id];
                }
            });
        }

        return layers;
    }

    getStateFromLocalStorage() {
        const savedState = JSON.parse(window.localStorage.getItem('appstate'));
        console.debug('Retrived saved state from local storage:', savedState);
        return savedState;
    }

    saveStateToLocalStorage() {
        requestAnimationFrame( () => {
            let layersStates = {};
            this.state.layers.forEach(l => {
                layersStates[l.id] = l.isActive;
            });

            const state = {
                area: this.state.area,
                showSatellite: this.state.showSatellite,
                zoom: this.state.zoom,
                lng: this.state.lng,
                lat: this.state.lat,
                layersStates: layersStates
            }

            let str = JSON.stringify(state);
            window.localStorage.setItem('appstate', str);
        });
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

    forceUpdate() {
        Analytics.event('force_update', {
            city_name: this.state.area
        });
        this.updateData(true);
    }

    geoJsonDiff(oldData, newData) {
        console.debug('oldData', oldData);
        console.debug('newData', newData);

        let a = new Set(oldData.features.map(i => i.id));
        let b = new Set(newData.features.map(i => i.id));
        
        // @todo compare full data, not only IDs
        // let a = new Set(oldData.features.map(i => JSON.stringify(i)));
        // let b = new Set(newData.features.map(i => JSON.stringify(i)));

        let a_minus_b = new Set([...a].filter(x => !b.has(x)));
        let b_minus_a = new Set([...b].filter(x => !a.has(x)));
        let a_intersect_b = new Set([...a].filter(x => b.has(x)));

        // a_minus_b = [...a_minus_b].map(i => JSON.parse(i));
        // b_minus_a = [...b_minus_a].map(i => JSON.parse(i));
        // a_intersect_b = [...a_intersect_b].map(i => JSON.parse(i));

        a_minus_b = [...a_minus_b];
        b_minus_a = [...b_minus_a];
        a_intersect_b = [...a_intersect_b];

        console.debug('Removed:', a_minus_b);
        console.debug('Added:', b_minus_a);
        console.debug('Might\'ve changed:', a_intersect_b);

        notification.success({
            message: 'Dados atualizados com sucesso',
            description:
                a_minus_b.length === 0 && b_minus_a.length === 0 ?
                <div>
                    Não houve alterações no mapa cicloviários desde a última atualização.
                </div>
                :
                <div>
                    <div>
                        <b>{a_minus_b.length}</b> removidos
                    </div>
                    <div>
                        <b>{b_minus_a.length}</b> adicionados
                    </div>
                </div>
        });
    }

    isDataHealthy(oldData, newData) {
        let isHealthy, before, after;

        if (DISABLE_DATA_HEALTY_TEST) {
            isHealthy = true;
        }

        if (!oldData || !oldData.features) {
            isHealthy = true;
        } else {
            before = oldData && oldData.features.length;
            after = newData && newData.features.length;
    
            console.debug('before', before);
            console.debug('after', after);
            console.debug('diff', after - before);
    
            isHealthy = !(after === 0 || after < before * THRESHOLD_NEW_VS_OLD_DATA_TOLERANCE);
        }

        Analytics.event('get_from_osm', {
            city_name: this.state.area,
            is_healthy: isHealthy,
            new_features: after - before 
        });

        return isHealthy;
    }

    getDataFromOSM(options = {}) {
        const {areaName = this.state.area, forceUpdate} = options;

        this.setState({ loading: true });

        return OSMController.getData({ area: areaName })
            .then(newData => {
                // this.geoJsonDiff(this.state.geoJson, newData.geoJson);

                if (forceUpdate && !this.isDataHealthy(this.state.geoJson, newData.geoJson)) {
                    throw new Error('New data is not healthy.');
                } else {
                    // Since this is a heavy operation we only do it when syncing with new OSM data
                    const lengths = calculateLayersLengths(this.state.geoJson, this.state.layers);
                    
                    if (SAVE_TO_FIREBASE) {
                        this.storage.save(areaName, newData.geoJson, lengths);
                    }

                    this.setState({
                        geoJson: newData.geoJson,
                        dataUpdatedAt: new Date(),
                        loading: false,
                        lengths: lengths
                    });
                }
            }).catch(e => {
                console.error(e);
                this.setState({
                    error: true
                });
            });
    }

    updateData(forceUpdate) {
        if (this.state.area) {
            if (forceUpdate) {
                this.getDataFromOSM({forceUpdate: true});
            } else {
                // Try to retrieve previously saved data for this area
                this.storage.load(this.state.area)
                    .then(data => {
                        if (data) {
                            console.debug('Database data is fresh.');

                            this.setState({
                                geoJson: data.geoJson,
                                lengths: data.lengths,
                                dataUpdatedAt: new Date(data.updatedAt),
                            });
                        } else { 
                            console.debug(`Couldn't find data for area ${this.state.area} or it isn't fresh, hitting OSM...`);
                            this.getDataFromOSM();
                        }
                    }).catch(e => {
                        notification['error']({
                            message: 'Erro',
                            description:
                                'Ocorreu um erro ao acessar o banco de dados.',
                        });
                    });
            }
        } else {
            this.setState({ loading: false });
        }
    }

    onMapStyleChange(newMapStyle) {
        this.setState({ mapStyle: newMapStyle});
    }

    onMapShowSatelliteChanged(showSatellite) {
        this.setState({ showSatellite: showSatellite });
    }

    onLayersChange(id, newVal) {
        let newLayers = Object.assign([], this.state.layers);
        let modifiedLayer = newLayers.filter(l => l.id === id)[0];
        modifiedLayer.isActive = newVal;

        this.setState({ layers: newLayers });
    }

    downloadData() {
        Analytics.event('purchase', {
            items: [{
                item_name : this.state.area,
                item_category: 'download',
                item_variant: 'geojson file'
            }],
        });

        // Enable only layers of type "way" to download
        const layerWays = this.state.layers.filter(l => l.type === 'way');
        computeTypologies(this.state.geoJson, layerWays);
        cleanUpOSMTags(this.state.geoJson);
        downloadObjectAsJson(this.state.geoJson, `ciclomapa-${this.state.area}`);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.location !== prevProps.location) {
            this.onRouteChanged();
        }

        if (this.state.area !== prevState.area) {
            console.debug(`Changed area from ${prevState.area} to ${this.state.area}`);
            
            Analytics.event('switch_city', {
                city_name: this.state.area
            });
            
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

        if (this.state.geoJson !== prevState.geoJson) {
            if (!this.state.geoJson || (this.state.geoJson.features && this.state.geoJson.features.length === 0)) {
                // @todo link to our tutorials and invite the user to start mapping it
                notification['warning']({
                    message: 'Ops',
                    description:
                        'Não há dados cicloviários para esta cidade.',
                });
            } else {
                // Retrocompatibility case where lengths weren't saved to database
                if (!this.state.lengths) {
                    console.debug('database didnt have lengths, computing...');
                    
                    this.setState({
                        lengths: calculateLayersLengths(this.state.geoJson, this.state.layers)
                    });
                }
            }
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

        requestAnimationFrame(() => {
            this.setState(newState);
        });
    }

    onSpinnerClose() {
        this.setState({
            error: false,
            loading: false
        });
    }

    render() {
        return (
            <div>
                {
                    !IS_PROD &&
                    <div className="flex w-full bg-yellow-300 text-black items-center justify-center text-center text-xs py-1">
                        Você está em um <b className="ml-1">ambiente de teste</b>. Pode futricar à vontade! ;)
                    </div>
                }
                
                <div className="flex">
                    <div className="relative w-full">
                        <TopBar
                            title={this.state.area}
                            lastUpdate={this.state.dataUpdatedAt}
                            lat={this.state.lat}
                            lng={this.state.lng}
                            z={this.state.zoom}
                            downloadData={this.downloadData}
                            // isDownloadUnavailable={this.state.isDownloadUnavailable}
                            onMapMoved={this.onMapMoved}
                            forceUpdate={this.forceUpdate}
                            isSidebarOpen={this.state.isSidebarOpen}
                            toggleSidebar={this.toggleSidebar}
                        />

                        <Map
                            ref={(map) => { window.map = map }}
                            data={this.state.geoJson}
                            layers={this.state.layers}
                            style={this.state.mapStyle}
                            zoom={this.state.zoom}
                            center={this.state.center}
                            showSatellite={this.state.showSatellite}
                            location={this.state.area}
                            updateData={this.updateData}
                            onMapMoved={this.onMapMoved}
                            updateLengths={this.updateLengths}
                            isSidebarOpen={this.state.isSidebarOpen}
                        />
                        
                        <MapStyleSwitcher 
                            showSatellite={this.state.showSatellite}
                            onMapStyleChange={this.onMapStyleChange}
                            onMapShowSatelliteChanged={this.onMapShowSatelliteChanged}
                        />

                        <div id="gradient-backdrop"/>
                    </div>

                    {
                        this.state.isSidebarOpen &&
                        <AnalyticsSidebar
                            layers={this.state.layers}
                            lengths={this.state.lengths}
                            open={this.state.isSidebarOpen}
                            toggle={this.toggleSidebar}
                            location={this.state.area}
                        />
                    }
                </div>

                <CitySwitcherBackdrop/>

                <LayersPanel
                    layers={this.state.layers}
                    lengths={this.state.lengths}
                    onLayersChange={this.onLayersChange}
                />

                {
                    this.state.loading &&
                    <Spinner
                        area={this.state.area}
                        error={this.state.error}
                        onClose={this.onSpinnerClose}
                    />
                }
            </div>
        );
    }
}

const withRouterAndRef = Wrapped => {
    const WithRouter = withRouter(({ forwardRef, ...otherProps }) => (
        <Wrapped ref={forwardRef} {...otherProps} />
    ))
    const WithRouterAndRef = React.forwardRef((props, ref) => (
        <WithRouter {...props} forwardRef={ref} />
    ))
    const name = Wrapped.displayName || Wrapped.name
    WithRouterAndRef.displayName = `withRouterAndRef(${name})`
    return WithRouterAndRef
}

export default withRouterAndRef(App);
