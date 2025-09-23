import React, { Component } from 'react';
import { IS_MOBILE, TOPBAR_HEIGHT } from './constants.js'

import bikeparkingIcon from './img/icons/poi-bikeparking-mini.png';
import bikeparkingIconLight from './img/icons/poi-bikeparking-mini--light.png';

class LayersBar extends Component {
    constructor(props) {
        super(props);
    }

    getActiveLayers() {
        const { layers } = this.props;
        return layers.filter(l => !l.onlyDebug);
    }

    getLayerCategories() {
        const activeLayers = this.getActiveLayers();
        
        const categories = {
            pontos: activeLayers.filter(l => l.type === 'poi'),
            outras: activeLayers.filter(l => 
                l.name === 'Baixa velocidade' || 
                l.name === 'Trilha' || 
                l.name === 'Proibido'
            )
        };
        
        return categories;
    }

    getIndividualLayers() {
        const activeLayers = this.getActiveLayers();
        
        return activeLayers.filter(l => 
            l.name === 'Ciclovia' || 
            l.name === 'Calçada compartilhada' || 
            l.name === 'Ciclofaixa' || 
            l.name === 'Ciclorrota'
        );
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

    renderLineStyle(style) {
        const background = style.lineStyle === 'solid' 
            ? style.lineColor
            : `repeating-linear-gradient(90deg, ${style.lineColor}, ${style.lineColor} 1px, transparent 1px, transparent 2px)`;
        
        return {
            background,
            // height: `${Math.max(2, style.lineWidth / 2)}px`
        };
    }

    renderLayerButton({ id, onClick, isActive, icon, lineStyle, label, className = '' }) {
        const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 border glass-bg flex-shrink-0';
        const activeClasses = isActive 
            ? 'text-white bg-black' 
            : 'text-gray-500';
        
        return (
            <button
                key={id}
                onClick={onClick}
                className={`${baseClasses} ${activeClasses} ${className}`}
            >
                <span className={`flex ${isActive ? '' : 'opacity-50'}`}>
                    {icon ? (
                        <img className="w-3 h-3" src={icon} alt="" />
                    ) : (
                        <span 
                            className="w-3 h-1 rounded"
                            style={this.renderLineStyle(lineStyle)}
                        />
                    )}
                </span>
                <span className=''>{label}</span>
            </button>
        );
    }

    render() {
        const { layers, embedMode, isDarkMode } = this.props;
        
        if (!IS_MOBILE || !layers || embedMode) {
            return null;
        }

        const categories = this.getLayerCategories();
        const individualLayers = this.getIndividualLayers();
        
        const categoryConfig = {
            pontos: {
                icon: isDarkMode ? bikeparkingIcon : bikeparkingIconLight,
                label: 'Pontos'
            },
            outras: {
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
                className="fixed left-0 right-0 px-2 overflow-scroll"
                style={{ 
                    top: `${TOPBAR_HEIGHT - 8}px`,
                    scrollbarWidth: 'none'
                }}
            >
                <div className="flex justify-start space-x-1">
                    {/* Pontos category button */}
                    {(() => {
                        const config = categoryConfig.pontos;
                        const isActive = this.isCategoryActive('pontos');
                        const hasLayers = categories.pontos.length > 0;
                        
                        if (!hasLayers) return null;
                        
                        return this.renderLayerButton({
                            id: 'pontos',
                            onClick: () => this.toggleCategory('pontos'),
                            isActive,
                            icon: config.icon,
                            lineStyle: config.style,
                            label: config.label
                        });
                    })()}
                    
                    {/* Individual layer buttons */}
                    {individualLayers.map(layer => {
                        const displayName = layer.displayName || layer.name;
                        
                        return this.renderLayerButton({
                            id: layer.id,
                            onClick: () => this.toggleLayer(layer.id),
                            isActive: layer.isActive,
                            lineStyle: layer.style,
                            label: displayName
                        });
                    })}
                    
                    {/* Outras category button (last) */}
                    {(() => {
                        const config = categoryConfig.outras;
                        const isActive = this.isCategoryActive('outras');
                        const hasLayers = categories.outras.length > 0;
                        
                        if (!hasLayers) return null;
                        
                        return this.renderLayerButton({
                            id: 'outras',
                            onClick: () => this.toggleCategory('outras'),
                            isActive,
                            icon: config.icon,
                            lineStyle: config.style,
                            label: config.label
                        });
                    })()}
                </div>
            </div>
        );
    }
}

export default LayersBar;
