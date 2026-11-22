import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Popover, Button, Flex, Typography } from 'antd';

import { HiEye as IconVisible, HiEyeOff as IconHidden } from 'react-icons/hi';

import InfrastructureBadge from './components/InfrastructureBadge';
import LayersVersionSwitch from './components/LayersVersionSwitch';
import PairingLayerOptions from './components/PairingLayerOptions';
import { getLayerLegendImageSrc } from './utils/utils.js';
import { IconSignal1, IconSignal2, IconSignal3 } from './components/ProtectionSignalIcons';
import {
  PAIRING_LAYER_GROUP,
  pairingGroupIsActive,
  pairingGroupSwatchLayers,
  pairingGroupToggleChanges,
  splitMapperLayerMenu,
} from './config/layersCatalog.js';

import './LayersPanel.css';
import './components/MapperBox.css';

import { IS_MOBILE, OUTRAS_VIAS_LAYER_NAMES } from './config/constants.js';

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
        <div
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--ant-color-fill-tertiary)' }}
        >
          <img
            className="block w-full h-auto"
            alt=""
            src={getLayerLegendImageSrc(layer.name)}
            loading="eager"
            decoding="async"
          />
        </div>

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

  renderPairingSwatch(layers) {
    const swatchLayers = pairingGroupSwatchLayers(layers);
    const colors = swatchLayers.map((layer) => layer.style?.lineColor).filter(Boolean);
    if (!colors.length) return null;
    return (
      <span className="w-full flex overflow-hidden" style={{ height: 4, borderRadius: '2px' }}>
        {colors.map((color, i) => (
          <span key={`${color}-${i}`} className="flex-1" style={{ background: color }} />
        ))}
      </span>
    );
  }

  renderPairingGroupRow(layers) {
    const isActive = pairingGroupIsActive(layers);
    return (
      <Popover
        placement="left"
        key={PAIRING_LAYER_GROUP.id}
        trigger={['hover', 'focus']}
        mouseEnterDelay={0.15}
        mouseLeaveDelay={0.2}
        destroyOnHidden={IS_MOBILE}
        styles={{
          container: { maxHeight: 'min(85vh, 560px)', overflow: 'auto' },
          content: { maxWidth: 'min(360px, calc(100vw - 24px))' },
        }}
        content={<PairingLayerOptions layers={layers} onLayersChange={this.props.onLayersChange} />}
      >
        <button
          type="button"
          className="flex w-full rounded-md items-center justify-between px-2 py-1 hover:bg-black hover:bg-opacity-70 text-left"
          onClick={() => this.props.onLayersChange(pairingGroupToggleChanges(layers))}
          style={{ opacity: isActive ? 1 : 0.5 }}
          aria-pressed={isActive}
          aria-label={PAIRING_LAYER_GROUP.label}
        >
          <div className="layer-panel-name flex items-center">
            <span className="w-6 mr-2 inline-block flex justify-center">
              {this.renderPairingSwatch(layers)}
            </span>
            <span className={`font-semibold ${this.props.embedMode ? 'text-xs' : ''}`}>
              {PAIRING_LAYER_GROUP.label}
            </span>
          </div>
          <div className="flex items-center">
            <div
              className={`ml-2 transition-opacity duration-300 ${this.state.hover || IS_MOBILE ? 'opacity-100' : 'opacity-0'}`}
            >
              {isActive ? <IconVisible /> : <IconHidden />}
            </div>
          </div>
        </button>
      </Popover>
    );
  }

  renderMapperLayers(mapperLayers) {
    return (
      <>
        {splitMapperLayerMenu(mapperLayers).map((item) =>
          item.type === 'pairing'
            ? this.renderPairingGroupRow(item.layers)
            : this.renderLayerRow(item.layer)
        )}
      </>
    );
  }

  renderLayerRow(l) {
    const { embedMode } = this.props;
    return (
      <Popover
        placement="left"
        key={l.name}
        destroyOnHidden={IS_MOBILE}
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
                    height: 4,
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
                <img
                  className="h-4"
                  style={{ borderRadius: '4px' }}
                  src={iconsMap[l.icon]}
                  alt=""
                />
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
    );
  }

  render() {
    const { layers, embedMode, showLayersVersionSwitch, layersVersion, onLayersVersionChange } =
      this.props;

    if (!layers || (embedMode && IS_MOBILE)) {
      return null;
    }

    const visibleLayers = layers
      .filter((l) => (embedMode ? l.isActive : true))
      .filter((l) => l.isAvailable !== false);
    const regularLayers = visibleLayers.filter((l) => !l.onlyDebug);
    const mapperLayers = embedMode ? [] : visibleLayers.filter((l) => l.onlyDebug);

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
          {(mapperLayers.length > 0 || showLayersVersionSwitch) && (
            <div className="cm-mapper-box" data-mapper-box>
              <div className="cm-mapper-box__label px-2">Modo mapeador</div>
              {showLayersVersionSwitch && onLayersVersionChange && (
                <div className="px-2 py-1 mb-1">
                  <LayersVersionSwitch value={layersVersion} onChange={onLayersVersionChange} />
                </div>
              )}
              {this.renderMapperLayers(mapperLayers)}
            </div>
          )}
          {regularLayers.map((l) => this.renderLayerRow(l))}
        </div>
      </>
    );
  }
}

LayersPanel.propTypes = {
  layers: PropTypes.array,
  lengths: PropTypes.object,
  onLayersChange: PropTypes.func.isRequired,
  layersVersion: PropTypes.string,
  onLayersVersionChange: PropTypes.func,
  showLayersVersionSwitch: PropTypes.bool,
  embedMode: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  openLayersLegendModal: PropTypes.func,
};

export default LayersPanel;
