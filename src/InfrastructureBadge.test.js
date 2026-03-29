import React from 'react';
import { render, screen } from '@testing-library/react';
import InfrastructureBadge, { normalizeLayersDefinitions } from './components/InfrastructureBadge';

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
