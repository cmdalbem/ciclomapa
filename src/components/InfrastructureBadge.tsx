import React from 'react';
import { hexToRgba, adjustColorBrightness } from '../utils/utils.js';
import * as layersDefinitions from '../config/layers.json';
import { ROUTE_COLORS } from '../config/constants.js';

export interface InfrastructureBadgeProps {
  children?: React.ReactNode;
  infrastructure?: string;
  isDarkMode?: boolean;
}

type LayerDefinition = { name: string; style?: { lineColor?: string } };

export function normalizeLayersDefinitions(input: unknown): LayerDefinition[] {
  if (Array.isArray(input)) return input as LayerDefinition[];
  if (input && typeof input === 'object') {
    const maybeDefault = (input as { default?: unknown }).default;
    if (Array.isArray(maybeDefault)) return maybeDefault as LayerDefinition[];
  }
  return [];
}

const getLayerColors = (): Record<string, string> => {
  const layers = normalizeLayersDefinitions(layersDefinitions);
  const colors: Record<string, string> = {};

  layers.forEach((layer) => {
    if (layer.style?.lineColor) {
      if (layer.name === 'Ciclovia') colors.ciclovia = layer.style.lineColor;
      else if (layer.name === 'Ciclofaixa') colors.ciclofaixa = layer.style.lineColor;
      else if (layer.name === 'Ciclorrota') colors.ciclorrota = layer.style.lineColor;
      else if (layer.name === 'Calçada compartilhada') colors.calçada = layer.style.lineColor;
    }
  });

  return colors;
};

const InfrastructureBadge: React.FC<InfrastructureBadgeProps> = ({
  children,
  infrastructure,
  isDarkMode = false,
}) => {
  const layerColors = getLayerColors();

  let textColor: string | undefined;
  let backgroundColor: string | undefined;

  if (infrastructure === 'rua') {
    const routeColor = isDarkMode ? ROUTE_COLORS.DARK.SELECTED : ROUTE_COLORS.LIGHT.SELECTED;
    textColor = isDarkMode ? 'white' : adjustColorBrightness(routeColor, -0.3);
    backgroundColor = hexToRgba(routeColor, isDarkMode ? 0.6 : 0.2);
  } else if (infrastructure) {
    const badgeColor = layerColors[infrastructure];
    if (badgeColor) {
      if (infrastructure === 'ciclovia' || infrastructure === 'calçada') {
        textColor = adjustColorBrightness(badgeColor, isDarkMode ? 0.8 : -0.4);
        backgroundColor = hexToRgba(badgeColor, isDarkMode ? 0.9 : 0.13);
      } else if (infrastructure === 'ciclofaixa' || infrastructure === 'ciclorrota') {
        textColor = isDarkMode ? badgeColor : adjustColorBrightness(badgeColor, -0.4);
        backgroundColor = hexToRgba(badgeColor, isDarkMode ? 0.4 : 0.2);
      }
    }
  }

  if (!textColor || !backgroundColor) {
    return null;
  }

  return (
    <span
      className="rounded-full font-medium text-xs px-1 py-0.5 flex items-center gap-1 text-nowrap whitespace-nowrap shrink-0"
      style={{ color: textColor, backgroundColor }}
    >
      {children}
    </span>
  );
};

export default InfrastructureBadge;
