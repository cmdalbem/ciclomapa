import React from 'react';
import { hexToRgba, adjustColorBrightness } from '../utils/utils.js';
import * as layersDefinitions from '../config/layers.json';
import { ROUTE_COLORS } from '../config/constants.js';

export interface InfrastructureBadgeProps {
  children?: React.ReactNode;
  infrastructure?: string;
  isDarkMode?: boolean;
}

type LayerDefinition = { name: string; style?: { lineColor?: string; lineColorDark?: string } };

export function normalizeLayersDefinitions(input: unknown): LayerDefinition[] {
  if (Array.isArray(input)) return input as LayerDefinition[];
  if (input && typeof input === 'object') {
    const maybeDefault = (input as { default?: unknown }).default;
    if (Array.isArray(maybeDefault)) return maybeDefault as LayerDefinition[];
  }
  return [];
}

const getLayerColors = (isDarkMode: boolean): Record<string, string> => {
  const layers = normalizeLayersDefinitions(layersDefinitions);
  const colors: Record<string, string> = {};

  layers.forEach((layer) => {
    const resolvedLineColor =
      (isDarkMode ? layer.style?.lineColorDark : undefined) ?? layer.style?.lineColor;

    if (resolvedLineColor) {
      if (layer.name === 'Ciclovia') colors.ciclovia = resolvedLineColor;
      else if (layer.name === 'Ciclofaixa') colors.ciclofaixa = resolvedLineColor;
      else if (layer.name === 'Ciclorrota') colors.ciclorrota = resolvedLineColor;
      else if (layer.name === 'Calçada compartilhada') colors.calçada = resolvedLineColor;
    }
  });

  return colors;
};

const InfrastructureBadge: React.FC<InfrastructureBadgeProps> = ({
  children,
  infrastructure,
  isDarkMode = false,
}) => {
  const layerColors = getLayerColors(isDarkMode);

  let textColor: string | undefined;
  let backgroundColor: string | undefined;

  const getInvertedTextColor = (hex: string): string => {
    // Choose black/white text based on background luminance for contrast.
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Light background -> black text, dark background -> white text.
    return luminance > 0.35 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  };

  if (infrastructure === 'neutral') {
    textColor = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgb(55, 65, 81)';
    backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.06)';
  } else if (infrastructure === 'rua') {
    const routeColor = isDarkMode ? ROUTE_COLORS.DARK.SELECTED : ROUTE_COLORS.LIGHT.SELECTED;
    // Light mode: use solid black for AA contrast on the semi-transparent orange bg.
    textColor = isDarkMode ? 'white' : 'rgb(0, 0, 0)';
    backgroundColor = hexToRgba(routeColor, isDarkMode ? 0.9 : 0.2);
  } else if (infrastructure) {
    const badgeColor = layerColors[infrastructure];
    if (badgeColor) {
      if (infrastructure === 'ciclovia') {
        const bgHex = adjustColorBrightness(badgeColor, -0.22);
        backgroundColor = hexToRgba(bgHex, 1);
        textColor = getInvertedTextColor(bgHex);
      } else if (infrastructure === 'calçada') {
        const bgHex = adjustColorBrightness(badgeColor, 0);
        backgroundColor = hexToRgba(bgHex, 1);
        textColor = getInvertedTextColor(bgHex);
      } else if (infrastructure === 'ciclofaixa') {
        const bgHex = adjustColorBrightness(badgeColor, 0.18);
        backgroundColor = hexToRgba(bgHex, 1);
        textColor = getInvertedTextColor(bgHex);
      } else if (infrastructure === 'ciclorrota') {
        const bgHex = adjustColorBrightness(badgeColor, -0.08);
        backgroundColor = hexToRgba(bgHex, 1);
        textColor = getInvertedTextColor(bgHex);
      }
    }
  }

  if (!textColor || !backgroundColor) {
    return null;
  }

  return (
    <span
      className="rounded-full font-medium text-xs px-1.5 py-0.5 flex items-center gap-1 text-nowrap whitespace-nowrap shrink-0"
      style={{ color: textColor, backgroundColor }}
    >
      {children}
    </span>
  );
};

export default InfrastructureBadge;
