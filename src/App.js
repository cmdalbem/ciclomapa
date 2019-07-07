import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

// import { openDB, deleteDB, wrap, unwrap } from 'idb';

import Map from './Map.js'
import Spinner from './Spinner.js'
import MapStyleSwitcher from './MapStyleSwitcher.js'
import LayersPanel from './LayersPanel.js'
import OSMController from './OSMController.js'

import "antd/dist/antd.css";
import './App.css';

class App extends Component {
    geoJson;

    constructor(props) {
        super(props);

        this.updateData = this.updateData.bind(this);
        this.onMapStyleChange = this.onMapStyleChange.bind(this);
        this.onMapMoved = this.onMapMoved.bind(this);
        this.onLayersChange = this.onLayersChange.bind(this);

        const urlParams = this.getParamsFromURL();
        this.state = {
            geoJson: null,
            loading: true,
            layers: OSMController.getLayers(),
            mapStyle: 'mapbox://styles/mapbox/light-v10',
            zoom: urlParams.z || 13,
            area: 'Niterói, Rio de Janeiro, Brazil',
            center: [
                urlParams.lng || -43.1098110,
                urlParams.lat || -22.8948963]
        };
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

    updateData() {
        if (this.state.zoom > 10) {
            this.setState({ loading: true });

            OSMController.getData({area: this.state.area})
                .then(data => {
                    this.setState({
                        geoJson: data.geoJson,
                        loading: false
                    });
                });
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

    componentDidUpdate(prevProps, prevState) {
        if (this.props.location !== prevProps.location) {
            this.onRouteChanged();
        }

        if (this.state.area !== prevState.area) {
            console.log(`Changed area from ${prevState.area} to ${this.state.area}`);
            this.updateData();

            // Only redo the query if we need new data
            // if (!doesAContainsB(largestBoundsYet, newBounds)) {
            //     this.props.updateData();
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
        delete newState.area;

        this.setState(newState);
    }

    render() {
        return (
            <div>
                <Map
                    data={this.state.geoJson}
                    layers={this.state.layers}
                    style={this.state.mapStyle}
                    zoom={this.state.zoom}
                    center={this.state.center}
                    updateData={this.updateData}
                    onMapMoved={this.onMapMoved}
                />

                <h1 className="areaName">
                    {this.state.area}
                    <Spinner loading={this.state.loading} />
                </h1>

                <MapStyleSwitcher onMapStyleChange={this.onMapStyleChange}/>
 
                <LayersPanel
                    layers={this.state.layers}
                    onLayersChange={this.onLayersChange}
                />
            </div>
        );
    }
}

export default withRouter(App);
