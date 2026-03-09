import React from 'react';
import { render, screen } from '@testing-library/react';
import Logo from './components/Logo';

it('renders Logo with default className', () => {
  render(<Logo />);
  const svg = document.querySelector('.logo-svg');
  expect(svg).toBeInTheDocument();
  expect(svg).toHaveAttribute('width', '105');
  expect(svg).toHaveAttribute('height', '18');
});

it('renders Logo with custom className', () => {
  render(<Logo className="custom-class" />);
  const svg = document.querySelector('.logo-svg.custom-class');
  expect(svg).toBeInTheDocument();
});
