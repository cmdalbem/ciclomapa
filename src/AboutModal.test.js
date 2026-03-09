import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutModal from './AboutModal.js';

const noop = () => {};

it('renders when visible and contains expected content', () => {
  render(<AboutModal visible={true} onClose={noop} openLayersLegendModal={noop} />);
  expect(screen.getByText(/CicloMapa é uma plataforma/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /começar/i })).toBeInTheDocument();
});

it('close button calls onClose when clicked', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<AboutModal visible={true} onClose={onClose} openLayersLegendModal={noop} />);
  await user.click(screen.getByRole('button', { name: /começar/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
