import React from 'react';
import { render, screen } from '@testing-library/react';
import { DirectionsProvider, useDirections } from './contexts/DirectionsContext';

function Consumer() {
  const { directions, clearDirections } = useDirections();
  return (
    <div>
      <span data-testid="directions-null">{directions === null ? 'yes' : 'no'}</span>
      <button type="button" onClick={clearDirections}>
        Clear
      </button>
    </div>
  );
}

it('DirectionsProvider renders children and useDirections sees initial state', () => {
  render(
    <DirectionsProvider>
      <Consumer />
    </DirectionsProvider>
  );
  expect(screen.getByTestId('directions-null')).toHaveTextContent('yes');
});

it('clearDirections can be called without throwing', () => {
  render(
    <DirectionsProvider>
      <Consumer />
    </DirectionsProvider>
  );
  const button = screen.getByRole('button', { name: /clear/i });
  expect(button).toBeInTheDocument();
  button.click();
  expect(screen.getByTestId('directions-null')).toHaveTextContent('yes');
});
