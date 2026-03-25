import React, { Component } from 'react';

import { Button } from 'antd';

import { slugify } from './utils/utils.js';
import InfrastructureBadge from './components/InfrastructureBadge';
import { formatDistance, formatDuration } from './utils/routeUtils.js';
import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

import { HiOutlineXMark } from 'react-icons/hi2';
import {
  MdSignalCellularAlt2Bar as IconSignal2,
  MdSignalCellularAlt as IconSignal3,
  MdSignalCellularAlt1Bar as IconSignal1,
} from 'react-icons/md';

import { handleModalKeyDown, setupModalFocus, restoreModalFocus } from './modalFocusTrap';

const getInfrastructureFromLayerName = (layerName) => {
  const name = layerName.toLowerCase();
  if (name.includes('ciclovia')) return 'ciclovia';
  if (name.includes('calçada')) return 'calçada';
  if (name.includes('ciclofaixa')) return 'ciclofaixa';
  if (name.includes('ciclorrota')) return 'ciclorrota';
  return null;
};

const iconsMap = {
  'poi-comment': commentIcon,
  'poi-bikeparking': bikeparkingIcon,
  'poi-bikeshop': bikeshopIcon,
  'poi-rental': bikerentalIcon,
};

class LayersLegendModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeSection: null,
    };
    this.observer = null;
    this.modalRef = React.createRef();
    this.previousActiveElementRef = { current: null };
  }

  componentDidMount() {
    if (this.props.visible) {
      this.setupScrollspy();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      setupModalFocus(this.modalRef, this.previousActiveElementRef);
      this._boundKeyDown = (e) => handleModalKeyDown(e, this.modalRef, this.props.onClose);
      document.addEventListener('keydown', this._boundKeyDown);
      this.setupScrollspy();
      if (this.props.scrollToSection) {
        setTimeout(() => {
          this.scrollToSection(this.props.scrollToSection);
        }, 100);
      }
    }

    if (!this.props.visible && prevProps.visible) {
      document.removeEventListener('keydown', this._boundKeyDown);
      restoreModalFocus(this.previousActiveElementRef);
      this.cleanupScrollspy();
    }
  }

  componentWillUnmount() {
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    this.cleanupScrollspy();
  }

  setupScrollspy = () => {
    // Clean up existing observer
    this.cleanupScrollspy();

    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      const scrollContainer = document.getElementById('layers-legend-scroll');
      if (!scrollContainer) return;

      const sections = [
        'pontos-section',
        'vias-ciclaveis-section',
        'outras-vias-section',
        'routes-section',
      ];

      const options = {
        root: scrollContainer,
        rootMargin: '-140px 0px -66% 0px', // Trigger when section is near top, accounting for sticky header
        threshold: 0,
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.setState({ activeSection: entry.target.id });
          }
        });
      }, options);

      sections.forEach((sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
          this.observer.observe(element);
        }
      });
    }, 100);
  };

  cleanupScrollspy = () => {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  };

  scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    const scrollContainer = document.getElementById('layers-legend-scroll');
    if (element && scrollContainer) {
      // Account for sticky header height (approximately 140px)
      const offset = 140;
      scrollContainer.scrollTo({
        top: element.offsetTop - offset,
        behavior: 'smooth',
      });
    }
  };

  render() {
    const { visible, onClose, layers } = this.props;

    if (!layers) return null;

    const activeLayers = layers.filter((l) => !l.onlyDebug);

    // Group layers by category
    const pontosLayers = activeLayers.filter((l) => l.type === 'poi');
    const viasCiclaveisLayers = activeLayers.filter(
      (l) =>
        l.type === 'way' &&
        (l.name === 'Ciclovia' ||
          l.name === 'Calçada compartilhada' ||
          l.name === 'Ciclofaixa' ||
          l.name === 'Ciclorrota')
    );
    const outrasViasLayers = activeLayers.filter(
      (l) =>
        l.type === 'way' &&
        (l.name === 'Baixa velocidade' || l.name === 'Trilha' || l.name === 'Proibido')
    );

    const categoryContainerClasses = 'gap-4 grid grid-cols-1 md:grid-cols-2';

    const legendNavTabClass = (sectionId) => {
      const active = this.state.activeSection === sectionId;
      const base =
        'px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0';
      return `${base} ${
        active
          ? 'bg-white bg-opacity-5 text-white '
          : 'text-gray-400 hover:text-gray-100 hover:bg-white hover:bg-opacity-10'
      }`;
    };

    const renderLayer = (layer) => (
      <div
        key={layer.id}
        className="rounded-xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4"
      >
        <div className={`flex gap-4 ${layer.type === 'poi' ? 'md:flex-col flex-row' : 'flex-col'}`}>
          {/* Image/Icon */}
          <div className="flex-shrink-0">
            {layer.type === 'way' && (
              <img className="w-full rounded-md" alt="" src={'/' + slugify(layer.name) + '.png'} />
            )}

            {layer.type === 'poi' && layer.icon && (
              <img className="h-7 w-7 opacity-90" src={iconsMap[layer.icon]} alt="" />
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            {layer.type === 'way' && layer.style && (
              <div
                className="w-full h-1 my-3 rounded flex-shrink-0"
                style={{
                  background:
                    layer.style.lineStyle === 'solid'
                      ? layer.style.lineColor
                      : `repeating-linear-gradient(90deg, ${layer.style.lineColor}, ${layer.style.lineColor} 6px, transparent 6px, transparent 12px)`,
                  borderColor: layer.style.borderColor,
                  borderStyle: layer.style.borderStyle,
                  borderWidth: layer.style.borderWidth ? 1 : 0,
                }}
              />
            )}
            <div className="flex justify-between gap-3 items-start">
              <h3 className="text-base font-semibold leading-snug text-white mb-0 pr-1">
                {layer.displayName || layer.name}
              </h3>
              {layer.protectionLevel && layer.style && (
                <InfrastructureBadge
                  infrastructure={getInfrastructureFromLayerName(layer.name)}
                  isDarkMode={this.props.isDarkMode}
                >
                  {layer.protectionLevel === 'Alta' && <IconSignal3 />}
                  {layer.protectionLevel === 'Média' && <IconSignal2 />}
                  {layer.protectionLevel === 'Baixa' && <IconSignal1 />}
                  {layer.protectionLevel} proteção
                </InfrastructureBadge>
              )}
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-0 mt-2">{layer.description}</p>
          </div>
        </div>
      </div>
    );

    return (
      <div
        ref={this.modalRef}
        id="layers-legend-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Legenda do mapa"
        className={`
                    app-modal-root fixed bg-gray-800 text-gray-100 antialiased overflow-hidden
                    bottom-0 left-0 right-0 top-3 rounded-tl-2xl rounded-tr-2xl
                    transform will-change-transform
                    ${
                      visible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-12 pointer-events-none'
                    } 
                    transition-all duration-500 ease-out
                    md:inset-0 md:rounded-none md:translate-y-0
                `}
      >
        <div
          id="layers-legend-scroll"
          className="absolute inset-x-0 top-0 bottom-0 overflow-y-auto"
        >
          <div className="max-w-2xl mx-auto">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 px-5 pt-4 pb-3 bg-gray-800 border-b border-white border-opacity-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold tracking-tight text-white my-0 md:text-2xl">
                  Legenda
                </h2>
                <Button
                  type="text"
                  onClick={onClose}
                  aria-label="Fechar legenda"
                  className="text-gray-300 hover:text-white"
                  style={{
                    padding: 0,
                  }}
                >
                  <HiOutlineXMark className="text-2xl" aria-hidden />
                </Button>
              </div>

              {/* Tab Navigation */}
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mb-1">
                {pontosLayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => this.scrollToSection('pontos-section')}
                    className={legendNavTabClass('pontos-section')}
                  >
                    Pontos de interesse
                  </button>
                )}
                {viasCiclaveisLayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => this.scrollToSection('vias-ciclaveis-section')}
                    className={legendNavTabClass('vias-ciclaveis-section')}
                  >
                    Vias cicláveis
                  </button>
                )}
                {outrasViasLayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => this.scrollToSection('outras-vias-section')}
                    className={legendNavTabClass('outras-vias-section')}
                  >
                    Outras vias
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => this.scrollToSection('routes-section')}
                  className={legendNavTabClass('routes-section')}
                >
                  Rotas
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 pt-6 pb-10">
              <div className="space-y-10 mb-10">
                {/* Pontos de Interesse */}
                {pontosLayers.length > 0 && (
                  <div id="pontos-section">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                      Pontos de interesse
                    </h3>
                    <div className={categoryContainerClasses}>{pontosLayers.map(renderLayer)}</div>
                  </div>
                )}

                {/* Vias cicláveis */}
                {viasCiclaveisLayers.length > 0 && (
                  <div id="vias-ciclaveis-section">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                      Vias cicláveis
                    </h3>
                    <div className={categoryContainerClasses}>
                      {viasCiclaveisLayers.map(renderLayer)}
                    </div>
                  </div>
                )}

                {/* Outras vias */}
                {outrasViasLayers.length > 0 && (
                  <div id="outras-vias-section">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                      Outras vias
                    </h3>
                    <div className={categoryContainerClasses}>
                      {outrasViasLayers.map(renderLayer)}
                    </div>
                  </div>
                )}
              </div>

              {/* Route Coverage & Protection Scores Section */}
              <div id="routes-section" className="space-y-8 mb-10">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                    Rotas
                  </h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed mb-0 max-w-prose">
                    Quando você calcula uma rota, analisamos quantos quilômetros dela estão cobertos
                    por cada tipo de infraestrutura cicloviária. Cada tipo tem um peso diferente na
                    nota final, refletindo o nível de proteção e segurança oferecido.
                  </p>
                </div>

                {/* Protection Level Weights Table */}
                <div className="rounded-xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4 md:p-5 mb-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white border-opacity-15">
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Tipo
                          </th>
                          <th className="pb-3 px-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Proteção
                          </th>
                          <th className="pb-3 pl-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Peso
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Ciclovia', weight: 1.0, protection: 'Alta' },
                          {
                            name: 'Calçada compartilhada',
                            displayName: 'Calçadas',
                            weight: 0.8,
                            protection: 'Alta',
                          },
                          { name: 'Ciclofaixa', weight: 0.6, protection: 'Média' },
                          { name: 'Ciclorrota', weight: 0.4, protection: 'Baixa' },
                        ].map((infra) => {
                          const layer = viasCiclaveisLayers.find((l) => l.name === infra.name);
                          const color = layer?.style?.lineColor || '#999';
                          return (
                            <tr
                              key={infra.name}
                              className="border-b border-white border-opacity-10 last:border-0"
                            >
                              <td className="py-3 align-middle">
                                <div className="flex items-center gap-3">
                                  {layer && (
                                    <div
                                      className="w-5 h-1 rounded flex-shrink-0"
                                      style={{
                                        background:
                                          layer.style?.lineStyle === 'solid'
                                            ? color
                                            : `repeating-linear-gradient(90deg, ${color}, ${color} 4px, transparent 3px, transparent 6px)`,
                                        borderColor: layer.style?.borderColor,
                                        borderStyle: layer.style?.borderStyle,
                                        borderWidth: layer.style?.borderWidth ? 1 : 0,
                                      }}
                                    />
                                  )}
                                  <span className="font-medium text-gray-100">
                                    {infra.displayName || infra.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 inline-block">
                                {layer && (
                                  <InfrastructureBadge
                                    infrastructure={getInfrastructureFromLayerName(layer.name)}
                                    isDarkMode={this.props.isDarkMode}
                                  >
                                    {infra.protection === 'Alta' && <IconSignal3 />}
                                    {infra.protection === 'Média' && <IconSignal2 />}
                                    {infra.protection === 'Baixa' && <IconSignal1 />}
                                    {infra.protection}
                                  </InfrastructureBadge>
                                )}
                              </td>
                              <td className="py-3 pl-3 align-middle">
                                <span className="font-mono text-sm text-gray-400 tabular-nums">
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
                <p className="text-sm font-medium text-gray-400 mb-4">Alguns exemplos</p>

                {/* <div className="rounded-xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4 md:p-5"> */}
                <div>
                  <div className="space-y-6">
                    {/* Example 1: Perfect route */}
                    <div>
                      <div className="rounded-lg p-4 border border-white border-opacity-10 bg-gray-900 bg-opacity-80">
                        <div className="flex justify-between gap-3">
                          <div className="flex items-start min-w-0">
                            <div
                              className="flex items-center mr-3 bg-green-600 px-2 py-2 rounded-md text-xs md:text-sm leading-none font-mono text-center flex-shrink-0"
                              style={{ color: 'white' }}
                            >
                              100
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-white mb-2">
                                Rota 100% protegida
                              </span>
                              <div className="flex flex-wrap gap-2">
                                <InfrastructureBadge
                                  infrastructure="ciclovia"
                                  isDarkMode={this.props.isDarkMode}
                                >
                                  100% ciclovia
                                </InfrastructureBadge>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 text-right">
                            <span className="text-sm font-medium text-gray-200 mb-1">
                              {formatDuration(480)}
                            </span>
                            <span className="text-xs text-gray-500">{formatDistance(2500)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-mono leading-relaxed mt-3 mb-0">
                        100×1.0 = <strong className="text-gray-400">100</strong>
                      </p>
                    </div>

                    {/* Example 2: Mixed route */}
                    <div>
                      <div className="rounded-lg p-4 border border-white border-opacity-10 bg-gray-900 bg-opacity-80">
                        <div className="flex justify-between gap-3">
                          <div className="flex items-start min-w-0">
                            <div
                              className="flex items-center mr-3 bg-yellow-600 px-2 py-2 rounded-md text-xs md:text-sm leading-none font-mono text-center flex-shrink-0"
                              style={{ color: 'white' }}
                            >
                              55
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-white mb-2">
                                Rota mista
                              </span>
                              <div className="flex flex-wrap gap-2">
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
                          <div className="flex flex-col items-end flex-shrink-0 text-right">
                            <span className="text-sm font-medium text-gray-200 mb-1">
                              {formatDuration(720)}
                            </span>
                            <span className="text-xs text-gray-500">{formatDistance(3800)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-mono leading-relaxed mt-3 mb-0">
                        40×1.0 + 15×0.6 + 15×0.4 + 30×0 ={' '}
                        <strong className="text-gray-400">55</strong>
                      </p>
                    </div>

                    {/* Example 3: Low protection route */}
                    <div>
                      <div className="rounded-lg p-4 border border-white border-opacity-10 bg-gray-900 bg-opacity-80">
                        <div className="flex justify-between gap-3">
                          <div className="flex items-start min-w-0">
                            <div
                              className="flex items-center mr-3 bg-red-600 px-2 py-2 rounded-md text-xs md:text-sm leading-none font-mono text-center flex-shrink-0"
                              style={{ color: 'white' }}
                            >
                              32
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-white mb-2">
                                Rota menos protegida
                              </span>
                              <div className="flex flex-wrap gap-2">
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
                          <div className="flex flex-col items-end flex-shrink-0 text-right">
                            <span className="text-sm font-medium text-gray-200 mb-1">
                              {formatDuration(900)}
                            </span>
                            <span className="text-xs text-gray-500">{formatDistance(4200)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-mono leading-relaxed mt-3 mb-0">
                        80×0.4 + 20×0 = <strong className="text-gray-400">32</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-sm text-gray-400 leading-relaxed mt-2 mb-0 border-t border-white border-opacity-10 pt-8">
                  <strong className="font-semibold text-gray-300">Lembre-se:</strong> as rotas são
                  sugestões automáticas; sempre verifique as condições das vias, sinalização e
                  segurança antes de pedalar. As notas ajudam a comparar opções, mas não substituem
                  seu julgamento sobre a segurança real do trajeto.
                </p>
              </div>

              {/* Footer button */}
              <div className="flex justify-center pb-8">
                <Button className="w-full" type="primary" size="large" onClick={onClose}>
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
