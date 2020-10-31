import React, { Component } from 'react';

// import light from './img/light.png';
import normal from './img/normal.png';
import satellite from './img/satelite.png';

import './MapStyleSwitcher.css'

class MapStyleSwitcher extends Component {
    state = { selected: this.props.showSatellite ? 1 : 0 };

    options = [
        {
            name: 'dark',
            img: normal,
            // url: 'mapbox://styles/cmdalbem/ck14cy14g1vb81cp8hprnh4nx'
        },
        // {
        //     img: light,
        //     url: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'
        // },
        {
            name: 'satellite',
            img: satellite
        },
    ];

    componentDidUpdate(prevProps, prevState) {
        if (this.state !== prevState) {
            const selected = this.options[this.state.selected]
            // this.props.onMapStyleChange(selected.url)

            this.props.onMapShowSatelliteChanged(selected.name === 'satellite');
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
                            key={option.img}
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