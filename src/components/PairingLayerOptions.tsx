import React from 'react';
import { Checkbox, Switch, Typography } from 'antd';

import {
  PAIRING_LAYER_GROUP,
  PAIRING_LAYER_SECTIONS,
  pairingGroupIsActive,
  pairingGroupToggleChanges,
} from '../config/layersCatalog.js';

import './PairingLayerOptions.css';

const { Text } = Typography;

export type PairingLayer = {
  id: string;
  name: string;
  isActive: boolean;
  mapperGroupDefault?: boolean;
  mapperGroupSection?: string;
  style?: {
    lineColor?: string;
    lineStyle?: string;
  };
};

type LayerChange = { id: string; isActive: boolean };

type PairingLayerOptionsProps = {
  layers: PairingLayer[];
  onLayersChange: (idOrChanges: string | LayerChange[], newVal?: boolean) => void;
};

function waySwatchStyle(style?: PairingLayer['style']): React.CSSProperties {
  const color = style?.lineColor || '#888';
  const dashed = style?.lineStyle && style.lineStyle !== 'solid';
  return {
    background: dashed
      ? `repeating-linear-gradient(90deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`
      : color,
  };
}

export default function PairingLayerOptions({ layers, onLayersChange }: PairingLayerOptionsProps) {
  const anyOn = pairingGroupIsActive(layers);

  const renderOption = (layer: PairingLayer) => (
    <Checkbox
      key={layer.id}
      className="cm-pairing-popover__option"
      checked={layer.isActive}
      onChange={() => onLayersChange(layer.id, !layer.isActive)}
    >
      <span className="cm-pairing-popover__option-body">
        <span className="cm-pairing-popover__swatch" style={waySwatchStyle(layer.style)} />
        <span className="cm-pairing-popover__name">{layer.name}</span>
      </span>
    </Checkbox>
  );

  return (
    <div
      className="cm-pairing-popover"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="cm-pairing-popover__header">
        <div className="cm-pairing-popover__title">{PAIRING_LAYER_GROUP.label}</div>
        <Text className="cm-pairing-popover__desc">{PAIRING_LAYER_GROUP.description}</Text>
      </div>

      <div className="cm-pairing-popover__master">
        <span>Mostrar no mapa</span>
        <Switch
          size="small"
          checked={anyOn}
          aria-label="Mostrar pareamento no mapa"
          onChange={() => onLayersChange(pairingGroupToggleChanges(layers))}
        />
      </div>

      {PAIRING_LAYER_SECTIONS.map((section) => {
        const sectionLayers = layers.filter((layer) => layer.mapperGroupSection === section.id);
        if (!sectionLayers.length) return null;
        return (
          <div key={section.id} className="cm-pairing-popover__section">
            <div className="cm-pairing-popover__section-label">{section.label}</div>
            {sectionLayers.map(renderOption)}
          </div>
        );
      })}
      {layers
        .filter(
          (layer) =>
            !PAIRING_LAYER_SECTIONS.some((section) => section.id === layer.mapperGroupSection)
        )
        .map(renderOption)}
    </div>
  );
}
