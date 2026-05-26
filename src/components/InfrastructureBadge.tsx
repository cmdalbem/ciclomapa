import React from 'react';
import { hexToRgba, adjustColorBrightness } from '../utils/utils.js';
import * as layersDefinitions from '../config/layers.json';
import { INFRASTRUCTURE_BADGE_TOKENS, ROUTE_COLORS } from '../config/constants.js';

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

export function getInfrastructureBadgeColors(
  infrastructure: string | undefined,
  isDarkMode: boolean,
  layerColors: Record<string, string> = {}
) {
  if (!infrastructure) {
    return null;
  }

  const theme = isDarkMode ? 'dark' : 'light';

  if (infrastructure === 'neutral') {
    const { text, background } = INFRASTRUCTURE_BADGE_TOKENS.neutral[theme];
    return { textColor: text, backgroundColor: background };
  }

  const brightnessDelta =
    INFRASTRUCTURE_BADGE_TOKENS.layerBrightnessAdjust[
      infrastructure as keyof typeof INFRASTRUCTURE_BADGE_TOKENS.layerBrightnessAdjust
    ];
  const badgeColor = layerColors[infrastructure];
  if (!badgeColor || brightnessDelta === undefined) {
    return null;
  }

  const bgHex = adjustColorBrightness(badgeColor, isDarkMode ? -brightnessDelta : brightnessDelta);
  const normalized = bgHex.startsWith('#') ? bgHex.slice(1) : bgHex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const bgLuminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (textLuminance: number) => {
    const lighter = Math.max(bgLuminance, textLuminance);
    const darker = Math.min(bgLuminance, textLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  };
  const candidates = [
    { color: 'rgba(0, 0, 0, 0.9)', ratio: ratio(0) },
    { color: 'rgba(255, 255, 255, 0.9)', ratio: ratio(1) },
  ].sort((a, b) => b.ratio - a.ratio);
  const aaCompliant = candidates.filter((c) => c.ratio >= 4.5);

  return {
    textColor: (aaCompliant[0] ?? candidates[0]).color,
    backgroundColor: hexToRgba(bgHex, 1),
  };
}

const InfrastructureBadge: React.FC<InfrastructureBadgeProps> = ({
  children,
  infrastructure,
  isDarkMode = false,
}) => {
  const layers = normalizeLayersDefinitions(layersDefinitions);
  const layerColors: Record<string, string> = {
    rua: isDarkMode ? ROUTE_COLORS.DARK.SELECTED : ROUTE_COLORS.LIGHT.SELECTED,
  };
  layers.forEach((layer) => {
    const resolvedLineColor =
      (isDarkMode ? layer.style?.lineColorDark : undefined) ?? layer.style?.lineColor;
    if (!resolvedLineColor) return;
    if (layer.name === 'Ciclovia') layerColors.ciclovia = resolvedLineColor;
    else if (layer.name === 'Ciclofaixa') layerColors.ciclofaixa = resolvedLineColor;
    else if (layer.name === 'Ciclorrota') layerColors.ciclorrota = resolvedLineColor;
    else if (layer.name === 'Calçada compartilhada') layerColors.calçada = resolvedLineColor;
  });

  const colors = getInfrastructureBadgeColors(infrastructure, isDarkMode, layerColors);

  if (!colors) {
    return null;
  }

  return (
    <span
      className="rounded-full font-medium text-xs px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
      style={{ color: colors.textColor, backgroundColor: colors.backgroundColor }}
    >
      {children}
    </span>
  );
};

export default InfrastructureBadge;
