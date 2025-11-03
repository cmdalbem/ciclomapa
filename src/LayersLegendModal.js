import React, { Component } from 'react';

import {
    Button,
} from 'antd';

import { slugify } from './utils.js';
import InfrastructureBadge from './InfrastructureBadge.js';
import { formatDistance, formatDuration } from './routeUtils.js';
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
    constructor(props) {
        super(props);
        this.state = {
            activeSection: null
        };
        this.observer = null;
    }

    componentDidMount() {
        if (this.props.visible) {
            this.setupScrollspy();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible && !prevProps.visible) {
            this.setupScrollspy();
            if (this.props.scrollToSection) {
                // Wait for DOM to update, then scroll
                setTimeout(() => {
                    this.scrollToSection(this.props.scrollToSection);
                }, 100);
            }
        }
        
        if (!this.props.visible && prevProps.visible) {
            this.cleanupScrollspy();
        }
    }

    componentWillUnmount() {
        this.cleanupScrollspy();
    }

    setupScrollspy = () => {
        // Clean up existing observer
        this.cleanupScrollspy();

        // Use a small delay to ensure DOM is ready
        setTimeout(() => {
            const scrollContainer = document.getElementById('layers-legend-scroll');
            if (!scrollContainer) return;

            const sections = ['pontos-section', 'vias-ciclaveis-section', 'outras-vias-section', 'routes-section'];
            
            const options = {
                root: scrollContainer,
                rootMargin: '-140px 0px -66% 0px', // Trigger when section is near top, accounting for sticky header
                threshold: 0
            };

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.setState({ activeSection: entry.target.id });
                    }
                });
            }, options);

            sections.forEach(sectionId => {
                const element = document.getElementById(sectionId);
                if (element) {
                    this.observer.observe(element);
                }
            });
        }, 100);
    }

    cleanupScrollspy = () => {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        const scrollContainer = document.getElementById('layers-legend-scroll');
        if (element && scrollContainer) {
            // Account for sticky header height (approximately 140px)
            const offset = 140;
            scrollContainer.scrollTo({
                top: element.offsetTop - offset,
                behavior: 'smooth'
            });
        }
    }

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
            <div key={layer.id} className="rounded-lg p-4 bg-gray-900">
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
                            <h3 className="font-semibold text-base mb-0">
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
                        <p className="opacity-70 mb-0 text-xs md:text-base">
                            {layer.description}
                        </p>
                    </div>
                </div>
            </div>
        );

        return (
            <div 
                id="layers-legend-modal"
                className={`
                    fixed z-10 bg-gray-800 overflow-hidden
                    bottom-0 left-0 right-0 top-3 rounded-tl-2xl rounded-tr-2xl
                    transform will-change-transform
                    ${visible 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-12 pointer-events-none'
                    } 
                    transition-all duration-500 ease-out
                    md:inset-0 md:rounded-none md:translate-y-0
                `}
            >
            <div id="layers-legend-scroll" className="absolute inset-x-0 top-0 bottom-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-20 px-4 py-2 bg-gray-800">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg md:text-xl md:text-2xl my-0 md:my-4">Legenda</h2>
                            <Button 
                                type="text" 
                                onClick={onClose}
                                style={{
                                    padding: 0,
                                }}
                            >
                                <HiOutlineXMark className="text-lg md:text-xl"/>
                            </Button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex flex-nowrap overflow-x-auto">
                            {pontosLayers.length > 0 && (
                                <button
                                    onClick={() => this.scrollToSection('pontos-section')}
                                    className={`px-2 py-1 text-xs md:text-base rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                                        this.state.activeSection === 'pontos-section'
                                            ? 'bg-white bg-opacity-20'
                                            : 'hover:bg-white hover:bg-opacity-10'
                                    }`}
                                >
                                    Pontos de interesse
                                </button>
                            )}
                            {viasCiclaveisLayers.length > 0 && (
                                <button
                                    onClick={() => this.scrollToSection('vias-ciclaveis-section')}
                                    className={`px-2 py-1 text-xs md:text-base rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                                        this.state.activeSection === 'vias-ciclaveis-section'
                                            ? 'bg-white bg-opacity-20'
                                            : 'hover:bg-white hover:bg-opacity-10'
                                    }`}
                                >
                                    Vias cicláveis
                                </button>
                            )}
                            {outrasViasLayers.length > 0 && (
                                <button
                                    onClick={() => this.scrollToSection('outras-vias-section')}
                                    className={`px-2 py-1 text-xs md:text-base rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                                        this.state.activeSection === 'outras-vias-section'
                                            ? 'bg-white bg-opacity-20'
                                            : 'hover:bg-white hover:bg-opacity-10'
                                    }`}
                                >
                                    Outras vias
                                </button>
                            )}
                            <button
                                onClick={() => this.scrollToSection('routes-section')}
                                className={`px-2 py-1 text-xs md:text-base rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                                    this.state.activeSection === 'routes-section'
                                        ? 'bg-white bg-opacity-20'
                                        : 'hover:bg-white hover:bg-opacity-10'
                                }`}
                            >
                                Rotas
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 pt-8 pb-8">
                        <div className="space-y-8 mb-8">
                            {/* Pontos de Interesse */}
                            {pontosLayers.length > 0 && (
                                <div id="pontos-section">
                                    <h3 className="text-lg md:text-xl">Pontos de interesse</h3>
                                    <div className={categoryContainerClasses}>
                                        {pontosLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}

                            {/* Vias cicláveis */}
                            {viasCiclaveisLayers.length > 0 && (
                                <div id="vias-ciclaveis-section">
                                    <h3 className="text-lg md:text-xl">Vias cicláveis</h3>
                                    <div className={categoryContainerClasses}>
                                        {viasCiclaveisLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}

                            {/* Outras vias */}
                            {outrasViasLayers.length > 0 && (
                                <div id="outras-vias-section">
                                    <h3 className="text-lg md:text-xl">Outras vias</h3>
                                    <div className={categoryContainerClasses}>
                                        {outrasViasLayers.map(renderLayer)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Route Coverage & Protection Scores Section */}
                        <div id="routes-section" className="space-y-6 mb-8">
                            <div>
                                <h3 className="text-lg md:text-xl">Rotas</h3>
                                <p className="opacity-80 mb-6">
                                    Quando você calcula uma rota, analisamos quantos quilômetros dela estão cobertos por cada tipo de infraestrutura cicloviária. 
                                    Cada tipo tem um peso diferente na nota final, refletindo o nível de proteção e segurança oferecido.
                                </p>
                            </div>

                            {/* Protection Level Weights Table */}
                            <div className="rounded-lg p-4 bg-gray-900 mb-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white border-opacity-20">
                                                <th className="pb-2 text-left text-sm font-medium opacity-70">Tipo</th>
                                                <th className="pb-2 px-3 text-left text-sm font-medium opacity-70">Proteção</th>
                                                <th className="pb-2 pl-3 text-left text-sm font-medium opacity-70">Peso</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { name: 'Ciclovia', weight: 1.0, protection: 'Alta' },
                                                { name: 'Calçada compartilhada', displayName: 'Calçadas', weight: 0.8, protection: 'Alta' },
                                                { name: 'Ciclofaixa', weight: 0.6, protection: 'Média' },
                                                { name: 'Ciclorrota', weight: 0.4, protection: 'Baixa' }
                                            ].map((infra) => {
                                                const layer = viasCiclaveisLayers.find(l => l.name === infra.name);
                                                const color = layer?.style?.lineColor || '#999';
                                                return (
                                                    <tr key={infra.name} className="border-b border-white border-opacity-10">
                                                        <td className="py-3">
                                                            <div className="flex items-center gap-3">
                                                                {layer && (
                                                                    <div 
                                                                        className="w-4 h-1 rounded flex-shrink-0"
                                                                        style={{
                                                                            background: layer.style?.lineStyle === 'solid' 
                                                                                ? color
                                                                                : `repeating-linear-gradient(90deg, ${color}, ${color} 4px, transparent 3px, transparent 6px)`,
                                                                            borderColor: layer.style?.borderColor,
                                                                            borderStyle: layer.style?.borderStyle,
                                                                            borderWidth: layer.style?.borderWidth ? 1 : 0,
                                                                        }}
                                                                    />
                                                                )}
                                                                <span className="font-medium text-xs md:text-base">{infra.displayName || infra.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 inline-block">
                                                            {layer && (
                                                                <InfrastructureBadge 
                                                                    infrastructure={getInfrastructureFromLayerName(layer.name)}
                                                                    isDarkMode={this.props.isDarkMode}
                                                                >
                                                                    {infra.protection === 'Alta' && <IconSignal3/>}
                                                                    {infra.protection === 'Média' && <IconSignal2/>}
                                                                    {infra.protection === 'Baixa' && <IconSignal1/>}
                                                                    {infra.protection}
                                                                </InfrastructureBadge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pl-3">
                                                            <span className="font-mono text-sm md:text-base opacity-80">
                                                                {infra.weight.toFixed(1)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Visual Examples */}
                            <p className="opacity-80 mb-6">Alguns exemplos:</p>

                            <div className="rounded-lg p-4 bg-gray-900">
                                <div className="space-y-3">
                                    {/* Example 1: Perfect route */}
                                    <div className="rounded-lg p-3 border border-white border-opacity-5">
                                        <div className="flex justify-between gap-1">
                                            {/* Left column */}
                                            <div className="flex items-start">
                                                <div 
                                                    className="flex items-center mr-2 bg-green-600 px-1.5 py-1.5 rounded-md md:text-sm text-xs leading-none font-mono text-center" 
                                                    style={{color: 'white'}}>
                                                    100
                                                </div>
                                                <div className="flex flex-col flex-end">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="md:text-sm text-xs">Rota 100% protegida</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        <InfrastructureBadge 
                                                            infrastructure="ciclovia"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            100% ciclovia
                                                        </InfrastructureBadge>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right column */}
                                            <div className="flex flex-col flex-end flex-shrink-0">
                                                <span className="md:text-sm text-xs text-right mb-1">
                                                    {formatDuration(480)}
                                                </span>
                                                <span className="md:text-sm text-xs text-gray-400 text-right">
                                                    {formatDistance(2500)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs opacity-50 font-mono ml-0">
                                        100×1.0 = <strong>100</strong>
                                    </div>

                                    {/* Example 2: Mixed route */}
                                    <div className="rounded-lg p-3 border border-white border-opacity-5">
                                        <div className="flex justify-between gap-1">
                                            {/* Left column */}
                                            <div className="flex items-start">
                                                <div 
                                                    className="flex items-center mr-2 bg-yellow-600 px-1.5 py-1.5 rounded-md md:text-sm text-xs leading-none font-mono text-center" 
                                                    style={{color: 'white'}}>
                                                    55
                                                </div>
                                                <div className="flex flex-col flex-end">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="md:text-sm text-xs">Rota mista</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        <InfrastructureBadge 
                                                            infrastructure="ciclovia"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            40% ciclovia
                                                        </InfrastructureBadge>
                                                        <InfrastructureBadge 
                                                            infrastructure="ciclofaixa"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            15% ciclofaixa
                                                        </InfrastructureBadge>
                                                        <InfrastructureBadge 
                                                            infrastructure="ciclorrota"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            15% ciclorrota
                                                        </InfrastructureBadge>
                                                        <InfrastructureBadge 
                                                            infrastructure="rua"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            30% rua
                                                        </InfrastructureBadge>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right column */}
                                            <div className="flex flex-col flex-end flex-shrink-0">
                                                <span className="md:text-sm text-xs text-right mb-1">
                                                    {formatDuration(720)}
                                                </span>
                                                <span className="md:text-sm text-xs text-gray-400 text-right">
                                                    {formatDistance(3800)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs opacity-50 font-mono ml-0">
                                        40×1.0 + 15×0.6 + 15×0.4 + 30×0 = <strong>55</strong>
                                    </div>

                                    {/* Example 3: Low protection route */}
                                    <div className="rounded-lg p-3 border border-white border-opacity-5">
                                        <div className="flex justify-between gap-1">
                                            {/* Left column */}
                                            <div className="flex items-start">
                                                <div 
                                                    className="flex items-center mr-2 bg-red-600 px-1.5 py-1.5 rounded-md md:text-sm text-xs leading-none font-mono text-center" 
                                                    style={{color: 'white'}}>
                                                    32
                                                </div>
                                                <div className="flex flex-col flex-end">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="md:text-sm text-xs">Rota menos protegida</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        <InfrastructureBadge 
                                                            infrastructure="ciclorrota"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            80% ciclorrota
                                                        </InfrastructureBadge>
                                                        <InfrastructureBadge 
                                                            infrastructure="rua"
                                                            isDarkMode={this.props.isDarkMode}
                                                        >
                                                            20% rua
                                                        </InfrastructureBadge>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right column */}
                                            <div className="flex flex-col flex-end flex-shrink-0">
                                                <span className="md:text-sm text-xs text-right mb-1">
                                                    {formatDuration(900)}
                                                </span>
                                                <span className="md:text-sm text-xs text-gray-400 text-right">
                                                    {formatDistance(4200)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs opacity-50 font-mono ml-0">
                                        80×0.4 + 20×0 = <strong>32</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Disclaimer */}
                            <p className="opacity-80 mt-4 mb-6">
                                <b>Lembre-se:</b> as rotas são sugestões automáticas, sempre verifique as condições das vias, sinalização e segurança antes de pedalar! As notas ajudam a comparar opções, mas não substituem seu julgamento sobre a segurança real do trajeto.
                            </p>
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
            </div>
        );
    }
}

export default LayersLegendModal;
