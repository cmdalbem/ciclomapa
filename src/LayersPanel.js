import React, { Component } from 'react';

import { Switch, Popover } from 'antd';

import { slugify } from './utils.js'

import './LayersPanel.css';


const MAX_MINIATURE_LENGTH = 250;


class LayersPanel extends Component {
    biggestLength = 0;

    onChange(id, newVal) {
        this.props.onLayersChange(id, newVal)
    }

    calculateMiniatureLength(lengthInKm) {
        let normalizer = 1;
        if (this.biggestLength > MAX_MINIATURE_LENGTH) {
            normalizer = MAX_MINIATURE_LENGTH / this.biggestLength
        }

        if (lengthInKm > 0) {
            return 24 + lengthInKm * normalizer;
        } else {
            return 'auto';
        }
    }

    render() {
        let lengths = {};
        let hasLengths = false;
        if (this.props.lengths && Object.keys(this.props.lengths).length > 0) {
            this.props.layers.forEach(l => {
                hasLengths = true;
                lengths[l.id] = Math.round(this.props.lengths[l.id]);

                if (lengths[l.id] > this.biggestLength) {
                    this.biggestLength = lengths[l.id];
                }
            });
        }

        return (
            <div className="layers-panel">
                {
                    this.props.layers &&
                    this.props.layers.map(l =>
                        <Popover
                            placement="left"
                            content={(
                                <div style={{ maxWidth: '250px' }}>
                                    <p> 
                                        <img style={{ width: '100%' }} src={'/' + slugify(l.name) + '.png'} alt=""></img>
                                    </p>
                                    <div>
                                        {l.description}
                                    </div>
                                </div>
                            )}
                            arrowPointAtCenter={true}
                            key={l.name}
                        >
                            <div
                                className="layer-row"
                                onClick={this.onChange.bind(this, l.id, !l.isActive)}
                                style={{ opacity: l.isActive ? 1 : .5 }}
                            >
                                <div>
                                    <span className="layer-name">
                                        {l.name}
                                    </span>
                                </div>

                                <div>
                                    <span
                                        className={"layer-miniature " + (!hasLengths && 'loading')}
                                        style={{
                                            height: l.style.borderStyle === 'solid' ? '6px' : '4px',
                                            width: this.calculateMiniatureLength(lengths[l.id]),
                                            background: l.style.lineStyle === 'solid' ?
                                                l.style.lineColor
                                                : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, transparent 3px, transparent 6px)`,
                                            borderColor: l.style.borderColor,
                                            borderStyle: l.style.borderStyle,
                                            borderRadius: '2px',
                                            borderWidth: l.style.borderWidth ? l.style.borderWidth/2 : '0',
                                            borderLeft: 'none',
                                            borderRight: 'none',
                                            margin: '6px 4px 6px 0',
                                            transition: 'width 1s ease-in-out'
                                    }}
                                    ></span>

                                    {
                                        hasLengths &&
                                            <span
                                                className="layer-length"
                                                style={{
                                                    fontWeight: 300,
                                                    color: l.style.lineColor
                                                }}
                                            >
                                                {lengths[l.id]}km
                                            </span>
                                    }
                                </div>

                                {/* <Switch size="small" checked={l.isActive} /> */}
                            </div>
                        </Popover>
                    )
                }
            </div>
        )
    }
}

export default LayersPanel;