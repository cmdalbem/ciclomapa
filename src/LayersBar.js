import React, { Component } from 'react';
import { IS_MOBILE, TOPBAR_HEIGHT } from './constants.js'

import bikeparkingIcon from './img/icons/poi-bikeparking-mini.png';
import commentIcon from './img/icons/poi-comment-flat.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

class LayersBar extends Component {
    constructor(props) {
        super(props);
    }

    getLayerCategories() {
        const { layers } = this.props;
        
        // Filter out debug layers and only include active layers
        const activeLayers = layers.filter(l => !l.onlyDebug);
        
        const categories = {
            pontos: activeLayers.filter(l => l.type === 'poi'),
            ciclaveis: activeLayers.filter(l => 
                l.name === 'Ciclovia' || 
                l.name === 'Calçada compartilhada' || 
                l.name === 'Ciclofaixa' || 
                l.name === 'Ciclorrota'
            ),
            outras: activeLayers.filter(l => 
                l.name === 'Baixa velocidade' || 
                l.name === 'Trilha' || 
                l.name === 'Proibido'
            )
        };
        
        return categories;
    }

    // Get individual layers for one-button-per-layer approach
    getIndividualLayers() {
        const { layers } = this.props;
        
        // Filter out debug layers and only include active layers
        const activeLayers = layers.filter(l => !l.onlyDebug);
        
        return activeLayers;
    }

    // Category toggle method (kept for easy switching back)
    toggleCategory(category) {
        const { onLayersChange } = this.props;
        const categories = this.getLayerCategories();
        
        // Check if any layer in this category is active
        const hasActiveLayers = categories[category].some(layer => layer.isActive);
        const newState = !hasActiveLayers;
        
        // Prepare batch update with all layers in this category
        const layerChanges = categories[category].map(layer => ({
            id: layer.id,
            isActive: newState
        }));
        
        // Call onLayersChange with batch update
        onLayersChange(layerChanges);
    }

    // Individual layer toggle method
    toggleLayer(layerId) {
        const { onLayersChange } = this.props;
        const layers = this.getIndividualLayers();
        const layer = layers.find(l => l.id === layerId);
        
        if (layer) {
            onLayersChange(layerId, !layer.isActive);
        }
    }

    isCategoryActive(category) {
        const categories = this.getLayerCategories();
        return categories[category].some(layer => layer.isActive);
    }

    render() {
        const { layers, embedMode } = this.props;
        
        if (!IS_MOBILE || !layers || embedMode) {
            return null;
        }

        // Switch back to category grouping
        const categories = this.getLayerCategories();
        const categoryConfig = {
            pontos: {
                type: 'poi',
                icon: bikeparkingIcon,
                label: 'Pontos'
            },
            ciclaveis: {
                type: 'way',
                style: {
                    lineColor: '#A7C957',
                    lineWidth: 8,
                    lineStyle: 'solid'
                },
                label: 'Cicláveis'
            },
            outras: {
                type: 'way',
                style: {
                    lineColor: '#DC7C3B',
                    lineWidth: 8,
                    lineStyle: 'dashed'
                },
                label: 'Outras'
            }
        };

        return (
            <div 
                className="fixed left-0 z-50 px-2"
                style={{ top: `${TOPBAR_HEIGHT}px` }}
            >
                <div className="flex justify-center space-x-2">
                    {Object.keys(categoryConfig).map(categoryKey => {
                        const config = categoryConfig[categoryKey];
                        const isActive = this.isCategoryActive(categoryKey);
                        const hasLayers = categories[categoryKey].length > 0;
                        
                        if (!hasLayers) return null;
                        
                        return (
                            <button
                                key={categoryKey}
                                onClick={() => this.toggleCategory(categoryKey)}
                                className={`
                                    flex items-center space-x-2 px-3 py-2 rounded-full text-xs font-medium
                                    transition-all duration-200 border glass-bg
                                    ${isActive 
                                        ? 'text-white border-white bg-white bg-opacity-20' 
                                        : 'text-gray-500 border-white border-opacity-30 hover:border-opacity-50'
                                    }
                                `}
                            >
                                {config.type === 'poi' ? (
                                    <img className="w-3 h-3" src={config.icon} alt="" />
                                ) : (
                                    <span 
                                        className="w-3 h-0.5 rounded"
                                        style={{
                                            background: config.style.lineStyle === 'solid' 
                                                ? config.style.lineColor
                                                : `repeating-linear-gradient(90deg, ${config.style.lineColor}, ${config.style.lineColor} 1px, transparent 1px, transparent 2px)`,
                                            height: `${Math.max(2, config.style.lineWidth / 2)}px`
                                        }}
                                    />
                                )}
                                <span>{config.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }
}

export default LayersBar;
