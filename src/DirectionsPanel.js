import React, { Component } from 'react';
import { Button, Input, Space, Divider } from 'antd';
import { 
    HiOutlineMap as IconMap,
    HiOutlineLocationMarker as IconLocation,
    HiOutlineArrowRight as IconArrow,
    HiOutlineX as IconClose
} from "react-icons/hi";

import { testMapboxDirections } from './testDirections.js';
import './DirectionsPanel.css';

import {
    IS_MOBILE,
} from './constants.js'

const { TextArea } = Input;

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        
        this.state = {
            collapsed: IS_MOBILE,
            fromPoint: '-22.971177,-43.180278', // Copacabana (lat, lng)
            toPoint: '-22.983333,-43.200278',   // Ipanema (lat, lng)
            directions: null,
            loading: false,
            error: null
        }
    }

    toggleCollapse() {
        this.setState({
            collapsed: !this.state.collapsed
        });
    }

    async calculateDirections() {
        this.setState({ loading: true, error: null, directions: null });
        
        try {
            // Use the coordinates from the input fields
            const from = this.state.fromPoint;
            const to = this.state.toPoint;
            
            // Validate coordinates format
            if (!from || !to) {
                throw new Error('Please enter both from and to coordinates');
            }
            
            // Test the coordinates format (simple validation)
            const coordRegex = /^-?\d+\.\d+,-?\d+\.\d+$/;
            if (!coordRegex.test(from) || !coordRegex.test(to)) {
                throw new Error('Coordinates must be in format: lat,lng (e.g., -22.971177,-43.180278)');
            }
            
            // Parse coordinates from "lat,lng" strings to [lng, lat] arrays
            // Note: Mapbox expects [longitude, latitude] order
            const fromCoords = from.split(',').map(coord => parseFloat(coord.trim()));
            const toCoords = to.split(',').map(coord => parseFloat(coord.trim()));
            
            // Convert from [lat, lng] to [lng, lat] for Mapbox
            const fromMapbox = [fromCoords[1], fromCoords[0]]; // [lng, lat]
            const toMapbox = [toCoords[1], toCoords[0]]; // [lng, lat]
            
            console.log('Parsed coordinates:', { from: fromMapbox, to: toMapbox });
            
            const directions = await testMapboxDirections(fromMapbox, toMapbox);
            this.setState({ 
                directions, 
                loading: false 
            });
            console.log('Directions calculated:', directions);
        } catch (error) {
            this.setState({ 
                error: error.message, 
                loading: false 
            });
            console.error('Directions error:', error);
        }
    }

    clearDirections() {
        this.setState({ 
            directions: null, 
            error: null 
        });
    }

    render() {
        const { embedMode } = this.props;
        const { collapsed, fromPoint, toPoint, directions, loading, error } = this.state;
        
        if (embedMode) {
            return null;
        }

        return (
            <>
                {
                    IS_MOBILE &&
                        <div
                            id="directionsPanelMobileButton"
                            className={`
                                p-4 border border-white border-opacity-20 rounded text-lg fixed
                                ${collapsed ? 'text-gray-300' : 'text-gray-900 bg-gray-100'}`}
                            onClick={this.toggleCollapse}
                            style={{
                                bottom: 30,
                                right: 8,
                                background: collapsed ? '#1c1717' : ''
                            }}
                        >
                            <IconMap/>
                        </div>
                }
                <div
                    id="directionsPanel"
                    className={`
                        fixed text-white 
                        ${IS_MOBILE && 'rounded border border-white border-opacity-20 shadow-lg divide-y divide-white divide-opacity-10'}
                        ${IS_MOBILE && collapsed ? 'hidden ' : ''}
                        ${embedMode ? 'pointer-events-none ' : 'cursor-pointer '}
                    `}
                    style={{
                        top: IS_MOBILE ? 100 : 90,
                        left: 24,
                        background: IS_MOBILE && '#1c1717',
                        minWidth: '300px'
                    }}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold flex items-center">
                                <IconMap className="mr-2" />
                                Rotas
                            </h3>
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<IconClose />}
                                onClick={this.toggleCollapse}
                                className="text-white hover:text-gray-300"
                            />
                        </div>

                        <Space direction="vertical" size="small" className="w-full">
                            <div>
                                <label className="block text-sm mb-1">De:</label>
                                <Input
                                    value={fromPoint}
                                    onChange={(e) => this.setState({ fromPoint: e.target.value })}
                                    placeholder="lat,lng"
                                    className="text-black"
                                />
                            </div>

                            <div className="flex justify-center">
                                <IconArrow className="text-green-300" />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Para:</label>
                                <Input
                                    value={toPoint}
                                    onChange={(e) => this.setState({ toPoint: e.target.value })}
                                    placeholder="lat,lng"
                                    className="text-black"
                                />
                            </div>

                            <Divider className="my-2" />

                            <Button
                                type="primary"
                                onClick={this.calculateDirections}
                                loading={loading}
                                block
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Calcular rota
                            </Button>

                            {directions && (
                                <Button
                                    onClick={this.clearDirections}
                                    block
                                    className="text-white border-white hover:bg-white hover:text-black"
                                >
                                    Limpar resultados
                                </Button>
                            )}
                        </Space>

                        {error && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {error}
                            </div>
                        )}

                        {directions && (
                            <div className="mt-3 p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded">
                                <h4 className="font-semibold text-green-300 mb-2">Route Found!</h4>
                                <div className="text-sm">
                                    <div>Distance: {directions.routes?.[0]?.distance ? `${(directions.routes[0].distance / 1000).toFixed(2)} km` : 'N/A'}</div>
                                    <div>Duration: {directions.routes?.[0]?.duration ? `${Math.round(directions.routes[0].duration / 60)} min` : 'N/A'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }
}

export default DirectionsPanel;
