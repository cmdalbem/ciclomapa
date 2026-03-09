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
      <h1>CicloMapa</h1>
      <button type="button" onClick={() => setModalOpen(true)}>
        Abrir sobre
      </button>
      <AboutModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        openLayersLegendModal={() => {}}
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

  expect(screen.getByRole('heading', { name: /ciclomapa/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /abrir sobre/i }));
  const dialog = screen.getByRole('dialog', { name: /sobre o ciclomapa/i });
  expect(dialog).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /começar/i }));
  await waitFor(() => {
    const closedDialog = screen.getByRole('dialog', { name: /sobre o ciclomapa/i });
    expect(closedDialog).toHaveClass('opacity-0', 'pointer-events-none');
  });
});
