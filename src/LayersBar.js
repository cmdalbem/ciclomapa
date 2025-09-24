import React, { Component } from 'react';
import { IS_MOBILE, TOPBAR_HEIGHT } from './constants.js'

import bikeparkingIcon from './img/icons/poi-bikeparking-mini.png';
import bikeparkingIconLight from './img/icons/poi-bikeparking-mini--light.png';

class LayersBar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            outrasExpanded: false
        };
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

    // Toggle expansion of Outras category
    toggleOutrasExpansion() {
        const { onLayersChange } = this.props;
        const categories = this.getLayerCategories();
        
        this.setState(prevState => {
            const newExpanded = !prevState.outrasExpanded;
            
            // If expanding, activate all layers in the category
            if (newExpanded) {
                const layerChanges = categories.outras.map(layer => ({
                    id: layer.id,
                    isActive: true
                }));
                onLayersChange(layerChanges);
            }
            
            return {
                outrasExpanded: newExpanded
            };
        });
    }

    // Toggle individual layer in Outras category
    toggleOutrasLayer(layerId) {
        const { onLayersChange } = this.props;
        const currentLayer = this.props.layers.find(l => l.id === layerId);
        const newActiveState = !currentLayer?.isActive;
        
        onLayersChange(layerId, newActiveState);
        
        // If turning off a layer, check if all layers are now deactivated
        if (!newActiveState) {
            setTimeout(() => {
                const updatedCategories = this.getLayerCategories();
                const allDeactivated = updatedCategories.outras.every(layer => !layer.isActive);
                
                if (allDeactivated && this.state.outrasExpanded) {
                    this.setState({ outrasExpanded: false });
                }
            }, 0);
        }
    }

    isCategoryActive(category) {
        const categories = this.getLayerCategories();
        return categories[category].some(layer => layer.isActive);
    }

    renderLineStyle(style) {
        if (!style) return {};

        const background = style.lineStyle === 'solid' 
            ? style.lineColor
            : `repeating-linear-gradient(90deg, ${style.lineColor}, ${style.lineColor} 1px, transparent 1px, transparent 2px)`;
        
        return {
            background,
            // height: `${Math.max(2, style.lineWidth / 2)}px`
        };
    }

    renderLayerButton({ id, onClick, isActive, icon, lineStyle, label, className = '' }) {
        const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-full text-xs transition-all duration-200 glass-bg flex-shrink-0';
        const activeClasses = isActive 
            ? 'text-white bg-black bg-opacity-50' 
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
                    ) : lineStyle ? (
                        <span 
                            className="w-3 h-1 rounded"
                            style={this.renderLineStyle(lineStyle)}
                        />
                    ) : null}
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
                // style: {
                //     lineColor: '#DC7C3B',
                //     lineWidth: 8,
                //     lineStyle: 'dashed'
                // },
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
                        const hasLayers = categories.outras.length > 0;
                        const allLayersDeactivated = hasLayers && categories.outras.every(layer => !layer.isActive);
                        
                        // Only show Outras button if all layers are deactivated
                        if (!hasLayers || !allLayersDeactivated) return null;
                        
                        return this.renderLayerButton({
                            id: 'outras',
                            onClick: () => this.toggleOutrasExpansion(),
                            isActive: false, // Always false since we only show when all are deactivated
                            icon: config.icon,
                            lineStyle: config.style,
                            label: config.label
                        });
                    })()}
                    
                    {/* Individual Outras layers - show when any are active or when expanded */}
                    {(() => {
                        const hasActiveOutrasLayers = categories.outras.some(layer => layer.isActive);
                        const shouldShowIndividual = hasActiveOutrasLayers || this.state.outrasExpanded;
                        
                        if (!shouldShowIndividual) return null;
                        
                        return categories.outras.map(layer => {
                            const displayName = layer.displayName || layer.name;
                            
                            return this.renderLayerButton({
                                id: layer.id,
                                onClick: () => this.toggleOutrasLayer(layer.id),
                                isActive: layer.isActive,
                                lineStyle: layer.style,
                                label: displayName,
                                className: 'ml-2'
                            });
                        });
                    })()}
                </div>
            </div>
        );
    }
}

export default LayersBar;
