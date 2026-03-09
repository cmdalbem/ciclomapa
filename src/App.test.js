import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { DirectionsProvider } from './contexts/DirectionsContext';

// Smoke: minimal shell with Router and DirectionsProvider (avoids full App's Map/Firebase/etc in CI)
it('renders minimal shell with Router and DirectionsProvider without crashing', () => {
  render(
    <Router>
      <DirectionsProvider>
        <div data-testid="app-shell">App shell</div>
      </DirectionsProvider>
    </Router>
  );
  expect(screen.getByTestId('app-shell')).toBeInTheDocument();
});
