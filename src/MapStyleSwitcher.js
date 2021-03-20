import React, { Component } from 'react';

import normal from './img/normal.png';
import satellite from './img/satelite.png';
// import light from './img/light.png';

import './MapStyleSwitcher.css'

class MapStyleSwitcher extends Component {
    state = { selected: this.props.showSatellite ? 1 : 0 };

    options = [
        {
            name: 'dark',
            img: normal,
            // url: 'mapbox://styles/cmdalbem/ck14cy14g1vb81cp8hprnh4nx'
        },
        {
            name: 'satellite',
            img: satellite
        },
        // {
        //     name: 'light',
        //     img: light,
        //     url: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'
        // }, 
        // {
        //     name: 'basic-spring',
        //     img: light,
        //     url: 'mapbox://styles/cmdalbem/ckl5iootp3u6o18npmfknh78h'
        // },
        // {
        //     name: 'monochrome-dark',
        //     img: normal,
        //     url: 'mapbox://styles/cmdalbem/ckl5b2qol209318o7otf1gt5m'
        // },
    ];

    componentDidUpdate(prevProps, prevState) {
        if (this.state !== prevState) {
            const selected = this.options[this.state.selected]
            if (selected.name === 'dark' || selected.name === 'satellite') {
                this.props.onMapShowSatelliteChanged(selected.name === 'satellite');
            }

            if (selected.url) {
                this.props.onMapStyleChange(selected.url)
            }
        }
    }

    render() {
        return (
            <div id="mapSwitcher" className="switcher-bar">
                {
                    this.options.map( (option, i) =>
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