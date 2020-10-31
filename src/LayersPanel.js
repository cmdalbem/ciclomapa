import React, { Component } from 'react';
import { Popover } from 'antd';

import {
    MdVisibility,
    MdVisibilityOff,
} from "react-icons/md";

import { slugify } from './utils.js'
import iconComment from './img/icons/comment-flat.png';

import './LayersPanel.css';


class LayersPanel extends Component {
    state = {
        hover: false
    }

    onChange(id, newVal) {
        this.props.onLayersChange(id, newVal)
    }

    render() {
        if (!this.props.layers) {
            return;
        }

        return (
            <div
                id="layersPanel"
                className="fixed text-white"
                style={{bottom: 40, left: 12}}
                onMouseEnter={() => this.setState({hover: true})}
                onMouseLeave={() => this.setState({hover: false})}
            >
                {
                    this.props.layers.map(l =>
                        <Popover
                            placement="left"
                            arrowPointAtCenter={true} key={l.name}
                            content={(
                                <div style={{width: 300}}>
                                    {
                                        l.type === 'way' &&
                                        <img
                                            className="w-full mb-2" alt=""
                                            src={'/' + slugify(l.name) + '.png'}/>
                                    }
                                    
                                    { l.description }
                                </div>
                            )}
                        >
                            <div
                                className="flex cursor-pointer items-center justify-between px-3 py-0 sm:py-1 hover:bg-black hover:bg-opacity-50"
                                onClick={this.onChange.bind(this, l.id, !l.isActive)}
                                style={{ opacity: l.isActive ? 1 : .5 }}
                            >
                                <div className="flex items-center">
                                    <span className="w-3 sm:w-6 mr-2 inline-block flex justify-center">
                                    {
                                        l.type === 'way' ?
                                            <span className='w-full'
                                                style={{
                                                    height: l.style.lineWidth * 2,
                                                    background: l.style.lineStyle === 'solid' ?
                                                        l.style.lineColor
                                                        : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, transparent 3px, transparent 6px)`,
                                                    borderColor: l.style.borderColor,
                                                    borderStyle: l.style.borderStyle,
                                                    borderRadius: '2px',
                                                    borderWidth: l.style.borderWidth ? l.style.borderWidth/2 : '0',
                                                    borderLeft: 'none',
                                                    borderRight: 'none'
                                            }}
                                            ></span>
                                        : 
                                        <img className="h-5" src={iconComment} alt=""/>
                                    }
                                    </span>

                                    <span className="font-semibold">
                                        {l.name} 
                                    </span>

                                    {
                                        this.props.lengths
                                            && Object.keys(this.props.lengths).length > 0
                                            && this.props.lengths[l.id] > 0
                                            && <span className="text-sm" style={{ fontWeight: 300, opacity: .5 }}>
                                                {Math.round(this.props.lengths[l.id])}km
                                        </span>
                                    }
                                </div>

                                <div className={`ml-2 transition-opacity duration-300 ${this.state.hover ? 'opacity-100' : 'opacity-0'}`}>
                                    {
                                        l.isActive ?
                                            <MdVisibility/>
                                        :   <MdVisibilityOff/>
                                    }
                                </div>
                            </div>
                        </Popover>
                    )
                }
            </div>
        )
    }
}

export default LayersPanel;