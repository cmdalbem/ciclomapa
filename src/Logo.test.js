import React from 'react';
import { render, screen } from '@testing-library/react';
import Logo from './components/Logo';

it('renders Logo with default className', () => {
  render(<Logo />);
  const wordmark = screen.getByText('CICLOMAPA');
  expect(wordmark).toHaveClass('logo-wordmark');
  expect(wordmark).toHaveClass('font-heading-display');
});

it('renders Logo with custom className', () => {
  render(<Logo className="custom-class" />);
  const wordmark = screen.getByText('CICLOMAPA');
  expect(wordmark).toHaveClass('logo-wordmark');
  expect(wordmark).toHaveClass('custom-class');
});
