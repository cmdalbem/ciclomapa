import React, { Component } from 'react';

import './MapStyleSwitcher.css'

class MapStyleSwitcher extends Component {
    componentDidMount() {
        const layerList = document.getElementById('styles-menu');
        const inputs = layerList.getElementsByTagName('input');

        for (var i = 0; i < inputs.length; i++) {
            inputs[i].onclick = layer => {
                var layerId = layer.target.id;
                this.props.onMapStyleChange('mapbox://styles/mapbox/' + layerId)
            };
        }
    }

    render() {
        return (
            <div id='styles-menu'>
                <label>
                    <input id='light-v10' type='radio' name='rtoggle' value='light' defaultChecked />
                    Light
                </label>
                <label>
                    <input id='streets-v11' type='radio' name='rtoggle' value='streets' />
                    Streets
                </label>
                <label>
                    <input id='outdoors-v11' type='radio' name='rtoggle' value='outdoors' />
                    Outdoors
                </label>
                <label>
                    <input id='satellite-v9' type='radio' name='rtoggle' value='satellite' />
                    Satellite
                </label>
            </div>
        )
    }
}

export default MapStyleSwitcher;