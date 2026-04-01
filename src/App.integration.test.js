import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router } from 'react-router-dom';
import { DirectionsProvider } from './contexts/DirectionsContext';
import AboutModal from './AboutModal.js';

// Integration-style: a small user flow across a couple components/providers.
// Keep this minimal (real flows belong in Playwright).
function MinimalAppWithModal() {
  const [modalOpen, setModalOpen] = React.useState(false);
  return (
    <div>
      <h1 data-testid="app-title">CicloMapa</h1>
      <button type="button" data-testid="open-about-modal" onClick={() => setModalOpen(true)}>
        Abrir sobre
      </button>
      <AboutModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        openLayersLegendModal={() => {}}
        openCityPicker={() => {}}
      />
    </div>
  );
}

it('user can open and close About modal', async () => {
  const user = userEvent.setup();
  render(
    <Router>
      <DirectionsProvider>
        <MinimalAppWithModal />
      </DirectionsProvider>
    </Router>
  );

  expect(screen.getByTestId('app-title')).toBeInTheDocument();

  await user.click(screen.getByTestId('open-about-modal'));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toBeInTheDocument();
  expect(screen.getByTestId('about-modal-title')).toBeInTheDocument();

  await user.click(screen.getByTestId('about-modal-dismiss'));
  await waitFor(() => {
    const root = document.querySelector('.about-modal-root');
    expect(root).toBeTruthy();
    expect(root).toHaveClass('about-modal-root--closed');
  });
});
