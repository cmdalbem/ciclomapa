import React, { Component } from 'react';

import { Button } from 'antd';

import InfrastructureBadge from './components/InfrastructureBadge';
import { getLayerLegendImageSrc } from './utils/utils.js';
import LayerOsmFilters from './components/LayerOsmFilters';
import { IconSignal1, IconSignal2, IconSignal3 } from './components/ProtectionSignalIcons';
import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

import { HiOutlineXMark } from 'react-icons/hi2';

import {
  IS_MOBILE,
  ROUTE_COLORS,
  ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS,
} from './config/constants.js';
import {
  getModalFocusRestoreRef,
  handleModalKeyDown,
  setupModalFocus,
  restoreModalFocus,
} from './modalFocusTrap';

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
  }

  componentDidMount() {
    if (this.props.visible) {
      this.setupScrollspy();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      setupModalFocus(this.modalRef, getModalFocusRestoreRef(this));
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
      restoreModalFocus(getModalFocusRestoreRef(this));
      this.cleanupScrollspy();
    }

    if (
      this.props.visible &&
      prevProps.visible &&
      this.props.scrollToSection &&
      this.props.scrollToSection !== prevProps.scrollToSection
    ) {
      setTimeout(() => {
        this.scrollToSection(this.props.scrollToSection);
      }, 100);
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

      const tabsSticky = scrollContainer.querySelector('[data-legend-sticky-header]');
      const sections = [
        'pontos-section',
        'vias-ciclaveis-section',
        'outras-vias-section',
        'routes-section',
      ];

      const stickyTop = tabsSticky?.offsetHeight ?? 48;
      const options = {
        root: scrollContainer,
        rootMargin: `-${stickyTop}px 0px -66% 0px`,
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
    if (!element || !scrollContainer) return;

    const tabsSticky = scrollContainer.querySelector('[data-legend-sticky-header]');
    const stickyTop = tabsSticky?.getBoundingClientRect().height ?? 48;
    const padding = 8;
    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scrollTop =
      scrollContainer.scrollTop + (elementRect.top - containerRect.top) - stickyTop - padding;

    scrollContainer.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth',
    });
  };

  render() {
    const { onClose, layers } = this.props;

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

    const categoryContainerClasses = 'grid grid-cols-1 items-stretch gap-4 md:grid-cols-2';
    const sectionHeadingClass = 'text-2xl mt-8 mb-4 font-heading-display';
    const layerTitleClass = 'text-lg font-semibold leading-snug text-white mb-0 pr-1';

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

    const { visible } = this.props;
    const deferLegendImage = IS_MOBILE && !visible;

    const renderLayer = (layer) => (
      <div
        key={layer.id}
        className="flex h-full min-h-0 flex-col rounded-xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4"
      >
        <div
          className={`flex min-h-0 flex-1 gap-4 ${layer.type === 'poi' ? 'md:flex-col flex-row' : 'flex-col'}`}
        >
          {/* Image/Icon */}
          <div className="flex-shrink-0">
            {layer.type === 'way' &&
              (deferLegendImage ? (
                <div
                  className="w-full rounded-md"
                  style={{
                    aspectRatio: '16 / 10',
                    background: 'var(--ant-color-fill-tertiary)',
                  }}
                  aria-hidden
                />
              ) : (
                <img
                  className="w-full rounded-md"
                  alt=""
                  src={getLayerLegendImageSrc(layer.name)}
                  loading={IS_MOBILE ? 'lazy' : undefined}
                  decoding="async"
                />
              ))}

            {layer.type === 'poi' && layer.icon && (
              <img className="h-7 w-7 opacity-90" src={iconsMap[layer.icon]} alt="" />
            )}
          </div>

          <div className="min-w-0 flex-1">
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
            <div className="flex justify-between gap-2 items-start">
              <h3 className={layerTitleClass}>{layer.displayName || layer.name}</h3>
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
            <p className="mb-0 mt-2 text-sm leading-normal text-gray-400">{layer.description}</p>
          </div>
        </div>

        <LayerOsmFilters layer={layer} className="mt-auto shrink-0 pt-3" />
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
            <div className="sticky top-0 z-20 px-3 pt-4 pb-3 bg-gray-800" data-legend-sticky-header>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold tracking-tight text-white my-0 md:text-2xl">
                  Legenda
                </h2>
                <Button
                  type="text"
                  onClick={onClose}
                  shape="circle"
                  aria-label="Fechar legenda"
                  className="text-gray-300 hover:text-white"
                >
                  <HiOutlineXMark className="text-2xl" aria-hidden />
                </Button>
              </div>

              {/* Tab Navigation */}
              <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1 -mb-1">
                {viasCiclaveisLayers.length > 0 && (
                  <Button
                    type="text"
                    size="small"
                    shape="pill"
                    htmlType="button"
                    onClick={() => this.scrollToSection('vias-ciclaveis-section')}
                    className={legendNavTabClass('vias-ciclaveis-section')}
                  >
                    Vias cicláveis
                  </Button>
                )}
                {pontosLayers.length > 0 && (
                  <Button
                    type="text"
                    size="small"
                    shape="pill"
                    htmlType="button"
                    onClick={() => this.scrollToSection('pontos-section')}
                    className={legendNavTabClass('pontos-section')}
                  >
                    Pontos de interesse
                  </Button>
                )}
                {outrasViasLayers.length > 0 && (
                  <Button
                    type="text"
                    size="small"
                    shape="pill"
                    htmlType="button"
                    onClick={() => this.scrollToSection('outras-vias-section')}
                    className={legendNavTabClass('outras-vias-section')}
                  >
                    Outras vias
                  </Button>
                )}
                <Button
                  type="text"
                  size="small"
                  shape="pill"
                  htmlType="button"
                  onClick={() => this.scrollToSection('routes-section')}
                  className={legendNavTabClass('routes-section')}
                >
                  Rotas
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="px-3 pt-6 pb-10">
              <div className="space-y-10 mb-10">
                {/* Vias cicláveis */}
                {viasCiclaveisLayers.length > 0 && (
                  <div id="vias-ciclaveis-section">
                    <h3 className={sectionHeadingClass}>Vias cicláveis</h3>
                    <div className={categoryContainerClasses}>
                      {viasCiclaveisLayers.map(renderLayer)}
                    </div>
                  </div>
                )}

                {/* Pontos de Interesse */}
                {pontosLayers.length > 0 && (
                  <div id="pontos-section">
                    <h3 className={sectionHeadingClass}>Pontos de interesse</h3>
                    <div className={categoryContainerClasses}>
                      {pontosLayers.map(renderLayer)}
                      <div className="rounded-xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4">
                        <div className="flex gap-4 md:flex-col flex-row">
                          <div className="flex-shrink-0">
                            <img className="h-7 w-7 opacity-90" src={commentIcon} alt="" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={layerTitleClass}>Comentários da comunidade</h3>
                            <p className="text-sm text-gray-400 leading-normal mb-0 mt-2">
                              Enviados por quem usa o CicloMapa, servem para relatar problemas,
                              sugestões ou observações sobre o local para auxiliar parceiros
                              editores do OpenStreetMap.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Outras vias */}
                {outrasViasLayers.length > 0 && (
                  <div id="outras-vias-section">
                    <h3 className={sectionHeadingClass}>Outras vias</h3>
                    <div className={categoryContainerClasses}>
                      {outrasViasLayers.map(renderLayer)}
                    </div>
                  </div>
                )}
              </div>

              {/* Route Coverage & Protection Scores Section */}
              <div id="routes-section" className="space-y-8 mb-10">
                <div>
                  <h3 className={sectionHeadingClass}>Rotas</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-normal max-w-prose">
                    Quando você calcula uma rota, analisamos quantos quilômetros dela estão cobertos
                    por cada tipo de infraestrutura cicloviária. Cada tipo tem um peso diferente na
                    nota final, refletindo o nível de proteção e segurança oferecido.
                  </p>
                  <p className="text-sm md:text-base text-gray-300 leading-normal max-w-prose">
                    <strong>Lembre-se:</strong> as rotas são sugestões automáticas; sempre verifique
                    as condições das vias, sinalização e segurança antes de pedalar. As notas ajudam
                    a comparar opções, mas não substituem seu julgamento sobre a segurança real do
                    trajeto.
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
                          { name: 'Ciclovia', protection: 'Alta' },
                          {
                            name: 'Calçada compartilhada',
                            displayName: 'Calçadas',
                            protection: 'Alta',
                          },
                          { name: 'Ciclofaixa', protection: 'Média' },
                          { name: 'Ciclorrota', protection: 'Baixa' },
                          { name: 'Rua', infrastructure: 'rua', protection: 'Nenhuma' },
                        ].map((infra) => {
                          const weight = ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS[infra.name];
                          const layer = viasCiclaveisLayers.find((l) => l.name === infra.name);
                          const routeLineColor = this.props.isDarkMode
                            ? ROUTE_COLORS.DARK.SELECTED
                            : ROUTE_COLORS.LIGHT.SELECTED;
                          const color =
                            layer?.style?.lineColor ??
                            (infra.infrastructure === 'rua' ? routeLineColor : '#999');
                          const showLineSwatch = Boolean(layer || infra.infrastructure === 'rua');
                          return (
                            <tr
                              key={infra.name}
                              className="border-b border-white border-opacity-10 last:border-0"
                            >
                              <td className="py-3 align-middle">
                                <div className="flex items-center gap-3">
                                  {showLineSwatch && (
                                    <div
                                      className="w-5 h-1 rounded flex-shrink-0"
                                      style={{
                                        background:
                                          layer?.style?.lineStyle === 'solid'
                                            ? color
                                            : layer
                                              ? `repeating-linear-gradient(90deg, ${color}, ${color} 4px, transparent 3px, transparent 6px)`
                                              : color,
                                        borderColor: layer?.style?.borderColor,
                                        borderStyle: layer?.style?.borderStyle,
                                        borderWidth: layer?.style?.borderWidth ? 1 : 0,
                                      }}
                                    />
                                  )}
                                  <span className="font-medium text-gray-100">
                                    {infra.displayName || infra.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 inline-block">
                                {(layer || infra.infrastructure) && (
                                  <InfrastructureBadge
                                    infrastructure={
                                      infra.infrastructure ||
                                      getInfrastructureFromLayerName(layer.name)
                                    }
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
                                  {weight.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default LayersLegendModal;
