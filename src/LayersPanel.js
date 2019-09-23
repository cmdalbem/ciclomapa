import React, { Component } from 'react';

import { Switch, Tooltip } from 'antd';

import './LayersPanel.css';


class LayersPanel extends Component {
    onChange(id, newVal) {
        this.props.onLayersChange(id, newVal)
    }

    render() {
        return (
            <div className="layers-panel">
                {
                    this.props.layers &&
                    this.props.layers.map(l =>
                        <Tooltip
                            placement="left"
                            title={l.description}
                            arrowPointAtCenter={true}
                            key={l.name}
                        >
                            <div
                                className="layer-row"
                                onClick={this.onChange.bind(this, l.id, !l.isActive)}
                                style={{ opacity: l.isActive ? 1 : .6 }}
                            >
                                <Switch size="small" checked={l.isActive} />

                                <div>
                                    <span
                                        className="layer-miniature" 
                                        style={{
                                            height: l.style.lineWidth * 2,
                                            background: l.style.lineStyle === 'solid' ?
                                                l.style.lineColor
                                                : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, white 3px, white 6px)`,
                                            borderColor: l.style.borderColor,
                                            borderStyle: l.style.borderStyle,
                                            borderWidth: l.style.borderWidth ? l.style.borderWidth/2 : '0',
                                            borderLeft: 'none',
                                            borderRight: 'none'
                                    }}
                                    ></span>

                                    <span className="layer-name">
                                        {l.name}
                                    </span>
                                </div>
                            </div>
                        </Tooltip>
                    )
                }
            </div>
        )
    }
}

export default LayersPanel;