import React from 'react';
import { render, screen } from '@testing-library/react';
import InfrastructureBadge, {
  normalizeLayersDefinitions,
  getInfrastructureBadgeColors,
} from './components/InfrastructureBadge';
import { INFRASTRUCTURE_BADGE_TOKENS, ROUTE_COLORS } from './config/constants.js';

it('normalizes layer definitions when JSON export is an array', () => {
  const input = [{ name: 'Ciclovia', style: { lineColor: '#111111' } }];
  expect(normalizeLayersDefinitions(input)).toEqual(input);
});

it('normalizes layer definitions when JSON export is wrapped in default', () => {
  const input = { default: [{ name: 'Ciclofaixa', style: { lineColor: '#222222' } }] };
  expect(normalizeLayersDefinitions(input)).toEqual(input.default);
});

it('normalizes layer definitions to empty array for invalid input', () => {
  expect(normalizeLayersDefinitions(null)).toEqual([]);
  expect(normalizeLayersDefinitions({})).toEqual([]);
});

it('renders with infrastructure ciclovia', () => {
  render(<InfrastructureBadge infrastructure="ciclovia">Ciclovia</InfrastructureBadge>);
  expect(screen.getByText('Ciclovia')).toBeInTheDocument();
});

it('renders with infrastructure neutral', () => {
  render(<InfrastructureBadge infrastructure="neutral">POIs</InfrastructureBadge>);
  expect(screen.getByText('POIs')).toBeInTheDocument();
});

it('renders with infrastructure rua', () => {
  render(<InfrastructureBadge infrastructure="rua">Rua</InfrastructureBadge>);
  expect(screen.getByText('Rua')).toBeInTheDocument();
});

it('respects isDarkMode for rua', () => {
  const { rerender } = render(
    <InfrastructureBadge infrastructure="rua" isDarkMode={false}>
      Rua
    </InfrastructureBadge>
  );
  const span = screen.getByText('Rua');
  expect(span).toBeInTheDocument();
  rerender(
    <InfrastructureBadge infrastructure="rua" isDarkMode={true}>
      Rua
    </InfrastructureBadge>
  );
  expect(screen.getByText('Rua')).toBeInTheDocument();
});

it('returns null for unknown infrastructure', () => {
  const { container } = render(
    <InfrastructureBadge infrastructure="unknown">Label</InfrastructureBadge>
  );
  expect(container.firstChild).toBeNull();
});

describe('getInfrastructureBadgeColors', () => {
  it('returns neutral colors by theme', () => {
    const light = getInfrastructureBadgeColors('neutral', false);
    expect(light).toEqual({
      textColor: INFRASTRUCTURE_BADGE_TOKENS.neutral.light.text,
      backgroundColor: INFRASTRUCTURE_BADGE_TOKENS.neutral.light.background,
    });
  });

  it('returns rua colors via brightness adjust and contrast text', () => {
    const dark = getInfrastructureBadgeColors('rua', true, {
      rua: ROUTE_COLORS.DARK.SELECTED,
    });
    expect(dark).not.toBeNull();
    expect(dark.textColor).toMatch(/^rgb/);
    expect(dark.backgroundColor).toMatch(/^rgba\(.*,\s*1\)$/);
  });

  it('derives cycle badge from layer color and brightness adjust', () => {
    const result = getInfrastructureBadgeColors('ciclovia', false, {
      ciclovia: '#386641',
    });
    expect(result).not.toBeNull();
    expect(result.textColor).toMatch(/^rgb/);
    expect(result.backgroundColor).toMatch(/^rgba/);
  });

  it('returns null for unknown infrastructure type', () => {
    expect(getInfrastructureBadgeColors('unknown', false)).toBeNull();
  });

  it('uses black on light backgrounds and white on dark backgrounds', () => {
    expect(getInfrastructureBadgeColors('ciclovia', false, { ciclovia: '#FFFFFF' }).textColor).toBe(
      'rgba(0, 0, 0, 0.9)'
    );
    expect(getInfrastructureBadgeColors('ciclovia', false, { ciclovia: '#000000' }).textColor).toBe(
      'rgba(255, 255, 255, 0.9)'
    );
  });

  it('meets WCAG AA normal text contrast (4.5:1) for representative badge fills', () => {
    [
      ['ciclovia', '#386641'],
      ['ciclofaixa', '#E9C46A'],
      ['rua', ROUTE_COLORS.DARK.SELECTED],
    ].forEach(([type, color]) => {
      const { textColor, backgroundColor } = getInfrastructureBadgeColors(type, false, {
        [type]: color,
      });
      const bgMatch = backgroundColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      const bgHex =
        '#' +
        bgMatch
          .slice(1, 4)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('');
      expect(wcagContrastRatio(bgHex, textColor)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

function wcagContrastRatio(bgHex, fgRgb) {
  const parseHex = (hex) => {
    const n = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const relLum = (r, g, b) => {
    const ch = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : (s + 0.055) ** 2.4 / 1.055 ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [br, bg, bb] = parseHex(bgHex);
  const [fr, fg, fb] = fgRgb.match(/\d+/g).slice(0, 3).map(Number);
  const l1 = relLum(br, bg, bb);
  const l2 = relLum(fr, fg, fb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
