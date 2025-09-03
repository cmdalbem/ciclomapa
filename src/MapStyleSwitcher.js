import React, { Component } from 'react';

import normal from './img/normal.png';
import satellite from './img/satelite.png';
import light from './img/light.png';

import './MapStyleSwitcher.css'

class MapStyleSwitcher extends Component {
    state = { selected: this.props.showSatellite ? 1 : 0 };

    getOptions() {
        const isDarkMode = this.props.isDarkMode;
        
        return [
            {
                name: 'default',
                img: normal,
                url: isDarkMode 
                    ? 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm' // Dark style
                    : 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb' // Light style
            },
            {
                name: 'satellite',
                img: satellite
            }
        ];
    }

    componentDidUpdate(prevProps, prevState) {
        const options = this.getOptions();
        
        // Handle theme changes - update map style if default is selected
        if (prevProps.isDarkMode !== this.props.isDarkMode && this.state.selected === 0) {
            const defaultOption = options[0];
            if (defaultOption.url) {
                this.props.onMapStyleChange(defaultOption.url);
            }
        }
        
        // Handle style selection changes
        if (this.state !== prevState) {
            const selected = options[this.state.selected];
            if (selected.name === 'default' || selected.name === 'satellite') {
                this.props.onMapShowSatelliteChanged(selected.name === 'satellite');
            }

            if (selected.url) {
                this.props.onMapStyleChange(selected.url);
            }
        }
    }

    render() {
        const options = this.getOptions();
        
        return (
            <div id="mapSwitcher" className="switcher-bar">
                {
                    options.map( (option, i) =>
                        <div
                            onClick={() => this.setState({ selected: i })}
                            className={this.state.selected === i ? 'selected' : ''}
                            key={option.name}
                        >
                            <img src={option.img} alt=""/>
                        </div>
                    )
                }
            </div>
        )
    }
}

export default MapStyleSwitcher;