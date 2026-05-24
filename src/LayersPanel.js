import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Popover, Button, Flex, Typography } from 'antd';

import { HiEye as IconVisible, HiEyeOff as IconHidden } from 'react-icons/hi';

import { slugify } from './utils/utils.js';
import InfrastructureBadge from './components/InfrastructureBadge';
import { IconSignal1, IconSignal2, IconSignal3 } from './components/ProtectionSignalIcons';

import './LayersPanel.css';

import { IS_MOBILE } from './config/constants.js';

import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

const { Text } = Typography;

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

const VIAS_CICLAVEIS_LAYER_NAMES = new Set([
  'Ciclovia',
  'Calçada compartilhada',
  'Ciclofaixa',
  'Ciclorrota',
]);

const OUTRAS_VIAS_LAYER_NAMES = new Set(['Baixa velocidade', 'Trilha', 'Proibido']);

/** @returns {string | null} LayersLegendModal section id */
const getLegendSectionForLayer = (layer) => {
  if (layer.type === 'poi') return 'pontos-section';
  if (layer.type === 'way' && VIAS_CICLAVEIS_LAYER_NAMES.has(layer.name)) {
    return 'vias-ciclaveis-section';
  }
  if (layer.type === 'way' && OUTRAS_VIAS_LAYER_NAMES.has(layer.name)) {
    return 'outras-vias-section';
  }
  return null;
};

class LayersPanel extends Component {
  constructor(props) {
    super(props);

    this.toggleMobileCollapse = this.toggleMobileCollapse.bind(this);

    this.state = {
      hover: false,
      collapsed: IS_MOBILE,
    };
  }

  onChange(id, newVal) {
    this.props.onLayersChange(id, newVal);
  }

  toggleMobileCollapse() {
    this.setState({
      collapsed: !this.state.collapsed,
    });
  }

  openLegend(sectionId = null) {
    const { openLayersLegendModal } = this.props;
    if (openLayersLegendModal) {
      openLayersLegendModal(sectionId);
    }
  }

  renderPopoverContent(layer) {
    const { embedMode, openLayersLegendModal, isDarkMode } = this.props;
    const sectionId = getLegendSectionForLayer(layer);

    return (
      <div className="flex flex-col gap-3 max-w-full box-border">
        {layer.type === 'way' ? (
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--ant-color-fill-tertiary)' }}
          >
            <img className="block w-full h-auto" alt="" src={'/' + slugify(layer.name) + '.jpg'} />
          </div>
        ) : layer.icon ? (
          <div>
            <img
              className="block h-8 w-8 object-contain opacity-90"
              src={iconsMap[layer.icon]}
              alt=""
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1 min-w-0">
          <Flex align="center" gap="small" wrap="wrap">
            <span className="text-lg font-heading-display mt-2 mb-1">
              {layer.displayName || layer.name}
            </span>
            {layer.protectionLevel && layer.style && (
              <InfrastructureBadge
                infrastructure={getInfrastructureFromLayerName(layer.name)}
                isDarkMode={isDarkMode}
              >
                {layer.protectionLevel === 'Alta' && <IconSignal3 />}
                {layer.protectionLevel === 'Média' && <IconSignal2 />}
                {layer.protectionLevel === 'Baixa' && <IconSignal1 />}
                {layer.protectionLevel} proteção
              </InfrastructureBadge>
            )}
          </Flex>

          <Text className=" leading-normal !mb-0">{layer.description}</Text>
        </div>

        {!embedMode && openLayersLegendModal && sectionId && (
          <Button
            data-testid="layers-panel-popover-full-legend"
            onClick={(e) => {
              e.stopPropagation();
              this.openLegend(sectionId);
            }}
          >
            Leia mais
          </Button>
        )}
      </div>
    );
  }

  render() {
    const { layers, embedMode } = this.props;

    if (!layers || (embedMode && IS_MOBILE)) {
      return null;
    }

    return (
      <>
        <div
          id="layersPanel"
          className={`
                        fixed text-white rounded-xl
                        p-2
                        ${IS_MOBILE && 'bg-black rounded-xl border border-white border-opacity-20 shadow-lg divide-y divide-white divide-opacity-10'}
                        ${IS_MOBILE && this.state.collapsed ? 'hidden ' : ''}
                        ${embedMode ? 'pointer-events-none ' : 'cursor-pointer '}
                    `}
          style={{
            bottom: IS_MOBILE ? 100 : 16,
            left: 8,
            zIndex: IS_MOBILE ? 1000 : 1,
          }}
          onMouseEnter={() => this.setState({ hover: true })}
          onMouseLeave={() => this.setState({ hover: false })}
        >
          {layers
            .filter((l) => (embedMode ? l.isActive : true))
            .map((l) => (
              <Popover
                placement="left"
                key={l.name}
                styles={{
                  container: { maxHeight: 'min(85vh, 560px)', overflow: 'auto' },
                  content: { maxWidth: 'min(360px, calc(100vw - 24px))' },
                }}
                content={this.renderPopoverContent(l)}
              >
                <div
                  className="flex rounded-md items-center justify-between px-2 py-1 hover:bg-black hover:bg-opacity-70"
                  onClick={this.onChange.bind(this, l.id, !l.isActive)}
                  style={{ opacity: l.isActive ? 1 : 0.5 }}
                >
                  <div className="layer-panel-name flex items-center">
                    <span className="w-6 mr-2 inline-block flex justify-center">
                      {l.type === 'way' ? (
                        <span
                          className="w-full"
                          style={{
                            height: 6,
                            background:
                              l.style.lineStyle === 'solid'
                                ? l.style.lineColor
                                : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, transparent 3px, transparent 6px)`,
                            borderColor: l.style.borderColor,
                            borderStyle: l.style.borderStyle,
                            borderWidth: l.style.borderWidth ? 1 : 0,
                            borderRadius: '2px',
                            borderLeft: 'none',
                            borderRight: 'none',
                          }}
                        ></span>
                      ) : (
                        <img className="h-4" src={iconsMap[l.icon]} alt="" />
                      )}
                    </span>

                    <span className={`font-semibold ${embedMode ? 'text-xs' : ''}`}>
                      {l.displayName || l.name}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <div
                      className={`ml-2 transition-opacity duration-300 ${this.state.hover || IS_MOBILE ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {l.isActive ? <IconVisible /> : <IconHidden />}
                    </div>
                  </div>
                </div>
              </Popover>
            ))}
        </div>
      </>
    );
  }
}

LayersPanel.propTypes = {
  layers: PropTypes.array,
  lengths: PropTypes.object,
  onLayersChange: PropTypes.func.isRequired,
  embedMode: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  openLayersLegendModal: PropTypes.func,
};

export default LayersPanel;
