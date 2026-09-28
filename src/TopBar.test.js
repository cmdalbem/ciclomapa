import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import TopBar from './TopBar.js';

// Desktop, non-prod, comments on: exercises the widest set of controls.
jest.mock('./config/constants.js', () => {
  const actual = jest.requireActual('./config/constants.js');
  return { ...actual, IS_MOBILE: false, IS_PROD: false, ENABLE_COMMENTS: true };
});

// The real EditModal is an antd Modal whose Tailwind `hover:` classes trip jsdom's
// selector parser during focus handling. We only care about TopBar's open/close/
// checkbox wiring here.
jest.mock('./EditModal.js', () => {
  const React = require('react');
  return function EditModalStub({ open, onClose, onCheckboxChange, lat, lng, z }) {
    if (!open) return null;
    return (
      <div data-testid="edit-modal" data-lat={lat} data-lng={lng} data-z={z}>
        <input type="checkbox" aria-label="dismiss" onChange={onCheckboxChange} />
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    );
  };
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

const baseProps = {
  title: 'Porto Alegre, Rio Grande do Sul, Brasil',
  toggleTheme: jest.fn(),
  openAboutModal: jest.fn(),
  toggleSidebar: jest.fn(),
  toggleDirectionsPanel: jest.fn(),
  triggerGeolocate: jest.fn(),
  lat: -30.03,
  lng: -51.23,
  z: 12,
};

function renderTopBar(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/porto-alegre']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <TopBar {...baseProps} {...props} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(baseProps).forEach((v) => typeof v === 'function' && v.mockClear?.());
});

describe('TopBar (desktop)', () => {
  it('renders logo, search with the current city and the map action buttons', () => {
    renderTopBar();
    expect(screen.getByRole('link', { name: /ciclomapa/i })).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('button', { name: 'Buscar. Cidade atual: Porto Alegre, Rio Grande do Sul' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar minha localização' }));
    expect(baseProps.triggerGeolocate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Planejar rota de bicicleta' }));
    expect(baseProps.toggleDirectionsPanel).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic search label without a title', () => {
    renderTopBar({ title: '' });
    expect(screen.getByRole('button', { name: 'Buscar cidade ou endereço' })).toBeInTheDocument();
  });

  it('opens the city picker via the ?buscar query', () => {
    renderTopBar();
    fireEvent.click(screen.getByRole('button', { name: /Buscar\./ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/porto-alegre?buscar');
  });

  it('theme, Sobre and Métricas buttons call their handlers', () => {
    renderTopBar({ isDarkMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));
    expect(baseProps.toggleTheme).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Sobre' }));
    expect(baseProps.openAboutModal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Métricas' }));
    expect(baseProps.toggleSidebar).toHaveBeenCalledWith(true);
  });

  it('hides Métricas while the sidebar is open', () => {
    renderTopBar({ isSidebarOpen: true });
    expect(screen.queryByRole('button', { name: 'Métricas' })).not.toBeInTheDocument();
  });

  it('shows "Revisar ícones" only in debug mode and navigates to the dev page', () => {
    const { unmount } = renderTopBar();
    expect(screen.queryByRole('button', { name: 'Revisar ícones' })).not.toBeInTheDocument();
    unmount();
    renderTopBar({ debugMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar ícones' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dev/place-type-icons');
  });

  it('Colaborar > Adicionar comentário dispatches the newComment event', async () => {
    const listener = jest.fn();
    document.addEventListener('newComment', listener);
    renderTopBar();
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Colaborar/ }));
    const item = await screen.findByText('Adicionar comentário');
    fireEvent.click(item);
    expect(listener).toHaveBeenCalledTimes(1);
    document.removeEventListener('newComment', listener);
  });

  it('Colaborar > Editar mapa opens the EditModal first, then OSM directly once dismissed', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const getViewport = jest.fn(() => ({ lat: -30.1, lng: -51.1, zoom: 14 }));
    renderTopBar({ getViewport });

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Colaborar/ }));
    fireEvent.click(await screen.findByText('Editar mapa'));
    const modal = await screen.findByTestId('edit-modal');
    // Modal gets the live viewport, not the stale lat/lng props.
    expect(modal).toHaveAttribute('data-lat', '-30.1');
    expect(modal).toHaveAttribute('data-z', '14');
    expect(open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument());

    // Hidden antd popups keep stale content until they reopen, so close + reopen the
    // hover dropdown before clicking again.
    const collaborate = screen.getByRole('button', { name: /Colaborar/ });
    fireEvent.mouseLeave(collaborate);
    await act(() => new Promise((r) => setTimeout(r, 200)));
    fireEvent.mouseEnter(collaborate);
    await act(() => new Promise((r) => setTimeout(r, 200)));
    fireEvent.click(screen.getByText('Editar mapa'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    // getOsmUrl zooms one level in; what matters is the live viewport coords are used.
    expect(open.mock.calls[0][0]).toMatch(/openstreetmap\.org\/edit#map=\d+\/-30\.1\/-51\.1/);
    expect(open.mock.calls[0][1]).toBe('_blank');
    open.mockRestore();
  });

  it('overflow menu routes every entry to the right handler', async () => {
    renderTopBar({ debugMode: true, isDarkMode: false });
    const more = screen.getByRole('button', { name: 'Mais opções' });

    const clickEntry = async (label) => {
      fireEvent.click(more);
      const entries = await screen.findAllByText(label);
      const inMenu = entries.find((el) => el.closest('.topbar-nav-overflow-menu'));
      fireEvent.click(inMenu);
    };

    await clickEntry('Tema escuro');
    expect(baseProps.toggleTheme).toHaveBeenCalledTimes(1);

    await clickEntry('Sobre');
    expect(baseProps.openAboutModal).toHaveBeenCalledTimes(1);

    await clickEntry('Métricas');
    expect(baseProps.toggleSidebar).toHaveBeenCalledWith(true);

    await clickEntry('Revisar ícones');
    expect(screen.getByTestId('location')).toHaveTextContent('/dev/place-type-icons');
  });

  it('overflow menu shows the light-theme label when dark', async () => {
    renderTopBar({ isDarkMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
    expect(await screen.findByText('Tema claro')).toBeInTheDocument();
  });
});

describe('TopBar (embed mode)', () => {
  it('drops the search and nav and links to the full map', () => {
    renderTopBar({ embedMode: true });
    expect(screen.queryByRole('button', { name: /Buscar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sobre' })).not.toBeInTheDocument();
    const full = screen.getByRole('link', { name: /Ver mapa completo/ });
    expect(full).toHaveAttribute('target', '_blank');
    expect(full.getAttribute('href')).not.toContain('embed=true');
  });
});
