import React, { Component } from 'react';
import { Popover } from 'antd';

import {
    HiEye as IconVisible,
    HiEyeOff as IconHidden,
} from "react-icons/hi";
import {
    BsLayersFill as IconLayers,
} from "react-icons/bs";

import { slugify } from './utils.js'

import './LayersPanel.css';

import {
    IS_MOBILE,
} from './constants.js'

import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

const iconsMap = {
    "poi-comment": commentIcon,
    "poi-bikeparking": bikeparkingIcon,
    "poi-bikeshop": bikeshopIcon,
    "poi-rental": bikerentalIcon
}


class LayersPanel extends Component {
    constructor(props) {
        super(props);

        this.toggleMobileCollapse = this.toggleMobileCollapse.bind(this);
        
        this.state = {
            hover: false,
            collapsed: IS_MOBILE
        }
    }

    onChange(id, newVal) {
        this.props.onLayersChange(id, newVal)
    }

    toggleMobileCollapse() {
        this.setState({
            collapsed: !this.state.collapsed
        });
    }

    render() {
        const { layers, embedMode } = this.props;
        
        if (!layers || (embedMode && IS_MOBILE)) {
            return null;
        }

        return (
            <>
                {
                    IS_MOBILE &&
                        <div
                            id="layersPanelMobileButton"
                            className={`
                                p-4 border border-white border-opacity-20 rounded-full text-lg fixed
                                ${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                            onClick={this.toggleMobileCollapse}
                            style={{
                                bottom: 30,
                                left: 8,
                            }}
                        >
                            <IconLayers/>
                        </div>
                }
                <div
                    id="layersPanel"
                    className={`
                        fixed text-white
                        ${IS_MOBILE && 'bg-black rounded-xl border border-white border-opacity-20 shadow-lg divide-y divide-white divide-opacity-10'}
                        ${IS_MOBILE && this.state.collapsed ? 'hidden ' : ''}
                        ${embedMode ? 'pointer-events-none ' : 'cursor-pointer '}
                    `}
                    style={{
                        bottom: IS_MOBILE ? 100 : 30,
                        left: 8,
                        zIndex: IS_MOBILE ? 1000 : 1
                    }}
                    onMouseEnter={() => this.setState({hover: true})}
                    onMouseLeave={() => this.setState({hover: false})}
                >
                    {
                        layers
                        .filter(l => embedMode ? l.isActive : true)
                        .map(l =>
                            <Popover
                                placement="left"
                                key={l.name}
                                content={(
                                    <div style={{width: 320}}>
                                        {
                                            l.type === 'way' &&
                                            <img
                                                className="mb-3 -m-4" alt=""
                                                style={{ width: '352px', maxWidth: 'none' }}
                                                src={'/' + slugify(l.name) + '.png'}/>
                                        }

                                        <h3 className="text-2xl mb-1 tracking-tight">
                                            { l.displayName || l.name }
                                        </h3>
                                        
                                        { l.description }
                                    </div>
                                )}
                            >
                                <div
                                    className="flex rounded-md items-center justify-between px-2 py-1 hover:bg-black hover:bg-opacity-50"
                                    onClick={this.onChange.bind(this, l.id, !l.isActive)}
                                    style={{ opacity: l.isActive ? 1 : .5 }}
                                >
                                    <div className="flex items-center">
                                        <span className="w-6 mr-2 inline-block flex justify-center">
                                        {
                                            l.type === 'way' ?
                                                <span className='w-full'
                                                    style={{
                                                        height: 6,
                                                        background: l.style.lineStyle === 'solid' ?
                                                            l.style.lineColor
                                                            : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, transparent 3px, transparent 6px)`,
                                                        borderColor: l.style.borderColor,
                                                        borderStyle: l.style.borderStyle,
                                                        borderWidth: l.style.borderWidth ? 1 : 0,
                                                        borderRadius: '2px',
                                                        borderLeft: 'none',
                                                        borderRight: 'none'
                                                }}
                                                ></span>
                                            : 
                                            <img className="h-4" src={iconsMap[l.icon]} alt=""/>
                                        }
                                        </span>

                                        <span className={`font-semibold ${embedMode ? 'text-xs' : ''}`}>
                                            {l.displayName || l.name} 
                                        </span>

                                    </div>

                                    <div className="flex items-center">
                                        <div className={`ml-2 transition-opacity duration-300 ${this.state.hover || IS_MOBILE ? 'opacity-100' : 'opacity-0'}`}>
                                            {
                                                l.isActive ?
                                                    <IconVisible/>
                                                :   <IconHidden/>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </Popover>
                        )
                    }
                </div>
            </>
        )
    }
}

export default LayersPanel;