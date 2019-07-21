import React, { Component } from 'react';

import light from './img/light.png';
import normal from './img/normal.png';
import satelite from './img/satelite.png';

import './MapStyleSwitcher.css'

class MapStyleSwitcher extends Component {
    options = [
        {
            name: 'Light',
            img: light,
            url: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'
        },
        {
            name: 'Normal',
            img: normal,
            url: 'mapbox://styles/mapbox/streets-v11'
        },
        // {
        //     name: 'Dorsia',
        //     img: {},
        //     url: 'mapbox://styles/cmdalbem/cjgmxgkbw000n2rqtucat5zjz'
        // },
        {
            name: 'Mapa com satelite',
            img: satelite,
            url: 'mapbox://styles/cmdalbem/cjxsdwb907bfi1cqevxio2bst'
        },
    ];
    
    state = { selected: 0 };

    componentDidUpdate(prevProps, prevState) {
        if (this.state !== prevState) {
            const selected = this.options[this.state.selected]
            this.props.onMapStyleChange(selected.url)
        }
    }

    render() {
        return (
            <div className="switcher-bar">
                {
                    this.options.map( (option, i) =>
                        <div
                            onClick={() => this.setState({ selected: i })}
                            className={this.state.selected === i ? 'selected' : ''}
                        >
                            <img src={option.img} alt=""></img>
                        </div>
                    )
                }
            </div>
        )
    }
}

export default MapStyleSwitcher;