import React, { Component } from 'react';
import { withRouter } from "react-router-dom";

import './App.css';

import Map from './Map.js'
import Spinner from './Spinner.js'
import MapStyleSwitcher from './MapStyleSwitcher.js'
import OSMController from './OSMController.js'

class App extends Component {
    geoJson;

    constructor(props) {
        super(props);

        this.updateData = this.updateData.bind(this);
        this.onMapStyleChange = this.onMapStyleChange.bind(this);
        this.onMapMoved = this.onMapMoved.bind(this);

        const urlParams = this.getParamsFromURL();
        this.state = {
            geoJson: null,
            loading: true,
            mapStyle: 'mapbox://styles/mapbox/light-v10',
            zoom: urlParams.z || 13,
            center: [
                urlParams.lat || -43.19663687394814,
                urlParams.lng || -22.968419833847065]
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

    updateData(bbox) {
        this.setState({ loading: true });

        OSMController.getData(bbox)
            .then(data => {
                this.setState({
                    geoJson: data,
                    loading: false
                });
            });
    }

    onMapStyleChange(newMapStyle) {
        this.setState({ mapStyle: newMapStyle});
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.location !== prevProps.location) {
            this.onRouteChanged();
        }
        
        if (this.state.zoom !== prevState.zoom) {
            this.props.history.push({
                // pathname: '/dresses',
                search: `?zoom=${this.state.zoom}`
            })
        }
    }

    onRouteChanged() {
        this.setState(this.getParamsFromURL());
    }

    onMapMoved(newState) {
        console.log('map moved!', newState);
        
        // @todo Fix infinite loop
        // this.setState(newState);
    }

    render() {
        return (
            <div>
                <Map
                    data={this.state.geoJson}
                    style={this.state.mapStyle}
                    zoom={this.state.zoom}
                    center={this.state.center}
                    updateData={this.updateData}
                    onMapMoved={this.onMapMoved}
                />

                <Spinner loading={this.state.loading}/>

                <MapStyleSwitcher onMapStyleChange={this.onMapStyleChange}/>
            </div>
        );
    }
}

export default withRouter(App);
