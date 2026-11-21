import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import ApiDebugOverlay from './ApiDebugOverlay.jsx';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

beforeEach(() => {
  window.localStorage.clear();
});

it('toggles overlap halo from the header and persists the flag', () => {
  const onXray = jest.fn();
  window.addEventListener('ciclomapa:overlap-xray', onXray);

  render(
    <MemoryRouter>
      <ApiDebugOverlay initiallyOpen />
    </MemoryRouter>
  );

  onXray.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Overlap halo' }));
  expect(window.localStorage.getItem('ciclomapa-debug-overlap-xray')).toBe('1');
  expect(onXray.mock.calls[0][0].detail).toEqual({ enabled: true });

  fireEvent.click(screen.getByRole('button', { name: 'Overlap halo' }));
  expect(window.localStorage.getItem('ciclomapa-debug-overlap-xray')).toBe('0');
  expect(onXray.mock.calls[1][0].detail).toEqual({ enabled: false });

  window.removeEventListener('ciclomapa:overlap-xray', onXray);
});

it('opens the icon review page from a header icon', () => {
  render(
    <MemoryRouter initialEntries={['/porto-alegre']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ApiDebugOverlay initiallyOpen />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole('button', { name: 'Revisar ícones' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/dev/place-type-icons');
});
