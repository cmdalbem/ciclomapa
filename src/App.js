import React, { Component } from 'react';
import {
    useLocation,
    useNavigate,
    useParams,
  } from "react-router-dom";
  

import { notification } from 'antd';

import { get, set } from 'idb-keyval';

import { 
    MdRemove as IconRemove,
    MdAdd as IconAdd,
} from "react-icons/md";

import AboutModal from './AboutModal.js'
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
    IS_MOBILE,
    FORCE_RECALCULATE_LENGTHS_ALWAYS,
    DEFAULT_LENGTH_CALCULATE_STRATEGIES
} from './constants.js'

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
        this.openAboutModal = this.openAboutModal.bind(this);
        this.closeAboutModal = this.closeAboutModal.bind(this);
        this.onChangeStrategy = this.onChangeStrategy.bind(this);

        const urlParams = this.getParamsFromURL();
        
        const prev = urlParams.embed ? {} : this.getStateFromLocalStorage() || {};

        this.state = {
            area: prev.area || '',
            showSatellite: prev.showSatellite !== undefined ? prev.showSatellite : false,
            zoom: prev.zoom || urlParams.z || DEFAULT_ZOOM,
            center: [
                parseFloat(urlParams.lng) || prev.lng || DEFAULT_LNG,
                parseFloat(urlParams.lat) || prev.lat || DEFAULT_LAT],
            geoJson: null,
            debugMode: urlParams.debug || false,
            loading: false,
            mapStyle: DEFAULT_MAPBOX_STYLE,
            layers: this.initLayers(prev.layersStates, urlParams.debug || false),
            lengths: {},
            embedMode: urlParams.embed,
            isSidebarOpen: prev.isSidebarOpen !== undefined ? prev.isSidebarOpen : !IS_PROD,
            hideUI: !urlParams.embed,
            aboutModal: false,
            lengthCalculationStrategy: DEFAULT_LENGTH_CALCULATE_STRATEGIES
        };

        if (this.state.area) {
            this.updateData();
        }
    }

    onChangeStrategy(event) {
        this.setState({ lengthCalculationStrategy: event.target.value });
    }

    toggleSidebar(state) {
        this.setState({isSidebarOpen: state});
    }

    openAboutModal() {
        this.setState({ aboutModal: true })
    } 

    closeAboutModal() {
        this.setState({
            aboutModal: false,
            hideUI: false
        })
    }

    initLayers(layersStates, debugMode) {
        const layers = OSMController.getLayers(debugMode); 

        // Merge with locally saved state
        if (layersStates && Object.keys(layersStates).length > 0) {
            layers.forEach(l => {
                if (layersStates[l.id] !== undefined) {
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
        // requestAnimationFrame( () => {
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
                isSidebarOpen: this.state.isSidebarOpen,
                layersStates: layersStates,
            }

            let str = JSON.stringify(state);
            window.localStorage.setItem('appstate', str);
        // });
    }

    getParamsFromURL() {
        const possibleParams = [ 'z', 'lat', 'lng', 'embed', 'debug' ];
        const urlParams = new URLSearchParams(this.props.location.search);
        let paramsObj = {}

        possibleParams.forEach( p => {
            let value = urlParams.get(p);
            if (value) {
                paramsObj[p] = value;
            }
        })

        console.debug('url params obj:', paramsObj);

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

        if (!(oldData && oldData.features &&
            newData && newData.features)) {
            return;
        }

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
                        <IconAdd className="inline"/> <b>{b_minus_a.length}</b> adicionados
                    </div>
                    <div>
                        <IconRemove className="inline"/> <b>{a_minus_b.length}</b> removidos
                    </div>
                </div>
        });
    }

    // Sometimes some Overpass servers return empty results instead of an error state 
    isOSMDataHealthy(oldData, newData) {
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
                this.geoJsonDiff(this.state.geoJson, newData.geoJson);

                if (forceUpdate && !this.isOSMDataHealthy(this.state.geoJson, newData.geoJson)) {
                    throw new Error('New data is not healthy.');
                } else {
                    // Since this is a heavy operation we only do it when syncing with new OSM data
                    const lengths = calculateLayersLengths(newData.geoJson, this.state.layers, this.state.lengthCalculationStrategy);
                    
                    if (SAVE_TO_FIREBASE) {
                        this.storage.save(areaName, newData.geoJson, lengths)
                            .then(() => {
                                notification.success({
                                    message: 'Banco de dados atualizado',
                                    description: "O banco do CicloMapa foi atualizado com a versão mais recente dos dados desta cidade."
                                });
                            }).catch(e => {
                                notification['error']({
                                    message: 'Erro ao atualizar banco de dados',
                                    description:
                                        'Por alguma razão não conseguimos atualizar o banco de dados com esta versão dos dados. Por favor tente novamente ou contate os desenvolvedores.',
                                });
                            });
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

                            if (FORCE_RECALCULATE_LENGTHS_ALWAYS) {
                                data.lengths = calculateLayersLengths(data.geoJson, this.state.layers, this.state.lengthCalculationStrategy);
                            }

                            this.setState({
                                geoJson: data.geoJson,
                                lengths: data.lengths,
                                dataUpdatedAt: new Date(data.updatedAt),
                            });
                        } else { 
                            console.debug(`Couldn't find previously saved data for area ${this.state.area}, hitting OSM...`);

                            this.setState({
                                geoJson: null,
                                lengths: {},
                            })

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
        
        // Deep object clone
        var data = JSON.parse(JSON.stringify(this.state.geoJson));

        computeTypologies(data, layerWays);
        cleanUpOSMTags(data);
        downloadObjectAsJson(data, `ciclomapa-${this.state.area}`);
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
                    
                    this.calculateLengths();
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
                if (this.state.debugMode) {
                    params += `&debug=true`;
                }
                if (this.state.embedMode) {
                    params += `&embed=true`;
                }
                // @todo add me back!
                // this.props.history.push({
                //     search: params
                // })
        }

        if (this.state.lengthCalculationStrategy !== prevState.lengthCalculationStrategy) {
            // @todo olha a gambiarra!
            // Deep clone geoJson data to force Mapbox to update the data layers
            const clone = JSON.parse(JSON.stringify(this.state.geoJson));
            this.setState({
                geoJson: clone,
                lengths: calculateLayersLengths(clone, this.state.layers, this.state.lengthCalculationStrategy)
            });
        }
    }

    calculateLengths() {
        this.setState({
            lengths: calculateLayersLengths(this.state.geoJson, this.state.layers, this.state.lengthCalculationStrategy)
        });
    }

    componentDidMount() {
        if (!this.state.embedMode) {
            get('hasSeenWelcomeMsg')
                .then(data => {
                    if (!data) {
                        console.log('show welcome!!!!')
                        this.openAboutModal();
                        set('hasSeenWelcomeMsg', true);
                    }
                });
        }

        setTimeout(() => {
            if (!this.state.aboutModal) {
                this.setState({hideUI: false});
            }
        }, 1000);

        window.addEventListener('beforeunload', e => {
            this.saveStateToLocalStorage();
        });

        if (!this.state.debugMode) {
            const emptyFunc = () => {};
            console.log = emptyFunc;
            console.debug = emptyFunc;
            console.warn = emptyFunc;
            console.error = emptyFunc;
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
            <div id="ciclomapa" className={this.state.hideUI ? "hideUI" : ""}>
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
                            embedMode={this.state.embedMode}
                            openAboutModal={this.openAboutModal}
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
                            embedMode={this.state.embedMode}
                            debugMode={this.state.debugMode}
                        />
                        
                        {
                            !this.state.embedMode &&
                            <MapStyleSwitcher 
                                showSatellite={this.state.showSatellite}
                                onMapStyleChange={this.onMapStyleChange}
                                onMapShowSatelliteChanged={this.onMapShowSatelliteChanged}
                            />
                        }

                        {
                            !this.state.embedMode &&
                            <div id="gradient-backdrop"/>
                        }
                    </div>

                    {
                        !IS_MOBILE &&
                        !this.state.embedMode &&
                        this.state.isSidebarOpen &&
                            <AnalyticsSidebar
                                layers={this.state.layers}
                                lengths={this.state.lengths}
                                open={this.state.isSidebarOpen}
                                location={this.state.area}
                                lengthCalculationStrategy={this.state.lengthCalculationStrategy}
                                debugMode={this.state.debugMode}
                                toggle={this.toggleSidebar}
                                onChangeStrategy={this.onChangeStrategy}
                            />
                    }
                </div>

                <CitySwitcherBackdrop/>

                <LayersPanel
                    layers={this.state.layers}
                    lengths={this.state.lengths}
                    onLayersChange={this.onLayersChange}
                    embedMode={this.state.embedMode}
                />

                <AboutModal
                    visible={this.state.aboutModal}
                    onClose={this.closeAboutModal}
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

function withRouter(Component) {
    function ComponentWithRouterProp(props) {
      let location = useLocation();
      let navigate = useNavigate();
      let params = useParams();
      return (
        <Component
          {...props}
          router={{ location, navigate, params }}
          location={location}
        />
      );
    }
  
    return ComponentWithRouterProp;
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
