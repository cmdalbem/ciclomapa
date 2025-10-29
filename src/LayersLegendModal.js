import React, { Component } from 'react';

import {
    Button,
} from 'antd';

import { slugify } from './utils.js';
import InfrastructureBadge from './InfrastructureBadge.js';
import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

import { HiOutlineXMark } from 'react-icons/hi2';
import { MdSignalCellularAlt2Bar as IconSignal2, MdSignalCellularAlt as IconSignal3, MdSignalCellularAlt1Bar as IconSignal1 } from "react-icons/md";


const getInfrastructureFromLayerName = (layerName) => {
    const name = layerName.toLowerCase();
    if (name.includes('ciclovia')) return 'ciclovia';
    if (name.includes('calçada')) return 'calçada';
    if (name.includes('ciclofaixa')) return 'ciclofaixa';
    if (name.includes('ciclorrota')) return 'ciclorrota';
    return null;
}; 

const iconsMap = {
    "poi-comment": commentIcon,
    "poi-bikeparking": bikeparkingIcon,
    "poi-bikeshop": bikeshopIcon,
    "poi-rental": bikerentalIcon
}

class LayersLegendModal extends Component {
    render() {
        const { visible, onClose, layers } = this.props;

        if (!layers) return null;
 
        const activeLayers = layers.filter(l => !l.onlyDebug);

        // Group layers by category
        const pontosLayers = activeLayers.filter(l => l.type === 'poi');
        const viasCiclaveisLayers = activeLayers.filter(l => 
            l.type === 'way' && (
                l.name === 'Ciclovia' || 
                l.name === 'Calçada compartilhada' || 
                l.name === 'Ciclofaixa' || 
                l.name === 'Ciclorrota'
            )
        );
        const outrasViasLayers = activeLayers.filter(l => 
            l.type === 'way' && (
                l.name === 'Baixa velocidade' || 
                l.name === 'Trilha' || 
                l.name === 'Proibido'
            )
        );

        const categoryContainerClasses = "gap-3 grid grid-cols-1 md:grid-cols-2";

        const renderLayer = (layer) => (
            <div key={layer.id} className="rounded-lg p-4 glass-bg">
                <div className={`flex gap-3 ${layer.type === 'poi' ? 'md:flex-col flow-row' : 'flex-col'}`}>
                    {/* Image/Icon */}
                    <div className="flex-shrink-0">
                        {layer.type === 'way' && (
                            <img
                                className="w-100 rounded"
                                alt=""
                                src={'/' + slugify(layer.name) + '.png'}
                            />
                        )}
                        
                        {layer.type === 'poi' && layer.icon && (
                            <img 
                                className="h-6 w-6" 
                                src={iconsMap[layer.icon]} 
                                alt=""
                            />
                        )}
                    </div>
                    
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                        {layer.type === 'way' && layer.style && (
                            <div 
                                className="w-100 h-1 my-2 rounded flex-shrink-0"
                                style={{
                                    background: layer.style.lineStyle === 'solid' 
                                        ? layer.style.lineColor
                                        : `repeating-linear-gradient(90deg, ${layer.style.lineColor}, ${layer.style.lineColor} 6px, transparent 6px, transparent 12px)`,
                                    borderColor: layer.style.borderColor,
                                    borderStyle: layer.style.borderStyle,
                                    borderWidth: layer.style.borderWidth ? 1 : 0,
                                }}
                            />
                        )}
                        <div className="flex justify-between gap-2 mb-1">
                            <h3 className="font-semibold mb-0">
                                {layer.displayName || layer.name}
                            </h3>
                            {layer.protectionLevel && layer.style && (
                                <InfrastructureBadge 
                                    infrastructure={getInfrastructureFromLayerName(layer.name)}
                                    isDarkMode={this.props.isDarkMode}
                                >
                                    {layer.protectionLevel === 'Alta' && <IconSignal3/>}
                                    {layer.protectionLevel === 'Média' && <IconSignal2/>}
                                    {layer.protectionLevel === 'Baixa' && <IconSignal1/>}
                                    {layer.protectionLevel} proteção
                                </InfrastructureBadge>
                            )}
                        </div>
                        <p className="opacity-70 mb-0">
                            {layer.description}
                        </p>
                    </div>
                </div>
            </div>
        );

        return (
            <div 
                className={`
                    fixed inset-0 z-10 backdrop-filter backdrop-blur-md bg-black bg-opacity-50
                    ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-500
                `}
            >
                <div className="absolute inset-x-0 top-0 bottom-0 overflow-y-auto">
                    <div className="max-w-3xl mx-auto pt-8 pb-8 px-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Legenda</h2>
                            <Button 
                                type="text" 
                                onClick={onClose}
                            >
                                <HiOutlineXMark className="text-2xl"/>
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="space-y-8 mb-8">
                            {/* Pontos de Interesse */}
                            {pontosLayers.length > 0 && (
                                <div>
                                    <h3 className="text-lg">Pontos de interesse</h3>
                                    <div className={categoryContainerClasses}>
                                        {pontosLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}

                            {/* Vias cicláveis */}
                            {viasCiclaveisLayers.length > 0 && (
                                <div>
                                    <h3 className="text-lg">Vias cicláveis</h3>
                                    <div className={categoryContainerClasses}>
                                        {viasCiclaveisLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}

                            {/* Outras vias */}
                            {outrasViasLayers.length > 0 && (
                                <div>
                                    <h3 className="text-lg">Outras vias</h3>
                                    <div className={categoryContainerClasses}>
                                        {outrasViasLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer button */}
                        <div className="flex justify-center pb-8">
                            <Button className="w-full md:w-auto" type="primary" size="large" onClick={onClose}>
                                Entendi
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default LayersLegendModal;
