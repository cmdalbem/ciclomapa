import React, { Component } from 'react';
import './App.css';

import Map from './Map.js'


// function initStylesSwitcher() {
//     var layerList = document.getElementById('styles-menu');
//     var inputs = layerList.getElementsByTagName('input');

//     function switchLayer(layer) {
//         var layerId = layer.target.id;
//         map.setStyle('mapbox://styles/mapbox/' + layerId);
//         map.on('style.load', function () {
//             initMapLayers();
//         });
//     }

//     for (var i = 0; i < inputs.length; i++) {
//         inputs[i].onclick = switchLayer;
//     }
// }

class App extends Component {
    componentDidMount() {
        // initStylesSwitcher();
    }

    render() {
        return (
            <div>
                <Map/>

                <div id="spinner" className="loader-container">
                    <div className="loader">
                        <svg className="circular" viewBox='25 25 50 50'>
                            <circle className="path" cx='50' cy='50' r='20' fill='none' strokeWidth='4' strokeMiterlimit='10'
                            />
                        </svg>
                    </div>
                </div>

                <div id='styles-menu'>
                    <label>
                        <input id='streets-v11' type='radio' name='rtoggle' value='streets' />
                        Streets
                    </label>
                    <label>
                        <input id='light-v10' type='radio' name='rtoggle' value='light' defaultChecked />
                        Light
                    </label>
                    <label>
                        <input id='dark-v10' type='radio' name='rtoggle' value='dark' />
                        Dark
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
            </div>
        );
    }
}

export default App;
