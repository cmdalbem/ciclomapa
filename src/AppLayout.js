/**
 * Layout component for the main app shell: header, main (map), asides, modals.
 * Receives state and handlers from App to keep App.js focused on state and logic.
 */
import React from 'react';
import AboutModal from './AboutModal.js';
import LayersLegendModal from './LayersLegendModal.js';
import Map from './Map.js';
import CitySwitcherModal from './CitySwitcherModal';
import TopBar from './TopBar.js';
import LayersPanel from './LayersPanel.js';
import LayersBar from './LayersBar.js';
import DirectionsPanel from './DirectionsPanel.js';
import AnalyticsSidebar from './AnalyticsSidebar.js';
import { IS_MOBILE, IS_PROD, ENABLE_SATELLITE_TOGGLE } from './config/constants.js';

export default function AppLayout({ state, handlers, directionsPanelRef }) {
  return (
    <div
      id="ciclomapa"
      className={[state.hideUI ? 'hideUI' : '', state.isSidebarOpen ? 'analyticsSidebarOpen' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <h1 className="sr-only">CicloMapa</h1>
      {!IS_PROD && (
        <div className="fixed bottom-0 left-0 right-0 z-10 flex text-white opacity-20 items-center justify-center text-center text-xs py-1">
          Você está em um <b className="ml-1">ambiente de teste</b>, pode futricar à vontade! ;)
        </div>
      )}

      <div className="flex">
        <main className="relative w-full" id="main-map" aria-label="Mapa">
          {!(IS_MOBILE && state.isDirectionsPanelOpen) && (
            <header id="topbar-wrapper" aria-label="Barra superior">
              <TopBar
                title={state.area}
                lastUpdate={state.dataUpdatedAt}
                lat={state.lat}
                lng={state.lng}
                z={state.zoom}
                downloadData={handlers.downloadData}
                onMapMoved={handlers.onMapMoved}
                forceUpdate={handlers.forceUpdate}
                isSidebarOpen={state.isSidebarOpen}
                toggleSidebar={handlers.toggleSidebar}
                embedMode={state.embedMode}
                openAboutModal={handlers.openAboutModal}
                isDarkMode={state.isDarkMode}
                toggleTheme={handlers.toggleTheme}
                loading={state.loading}
              />
            </header>
          )}
          <Map
            key={state.mapKey}
            ref={(map) => {
              if (!IS_PROD && state.debugMode) {
                window.map = map;
              }
            }}
            data={state.geoJson}
            layers={state.layers}
            style={state.mapStyle}
            zoom={state.zoom}
            lat={state.lat}
            lng={state.lng}
            showSatellite={ENABLE_SATELLITE_TOGGLE ? state.showSatellite : false}
            location={state.area}
            onMapMoved={handlers.onMapMoved}
            updateLengths={handlers.updateLengths}
            embedMode={state.embedMode}
            debugMode={state.debugMode}
            isDarkMode={state.isDarkMode}
            setMapRef={handlers.setMapRef}
            directionsPanelRef={directionsPanelRef}
            toPoint={state.toPoint}
            isTrackingUserLocation={state.isTrackingUserLocation}
            onTrackingUserLocationChange={handlers.onTrackingUserLocationChange}
          />
          {/* {!state.embedMode && !IS_MOBILE && <div id="gradient-backdrop" />} */}

          {!IS_MOBILE && !state.embedMode && (
            <aside
              aria-label="Painel de análises"
              className={[
                'analytics-sidebar-overlay',
                state.isSidebarOpen
                  ? 'analytics-sidebar-overlay--open'
                  : 'analytics-sidebar-overlay--closed',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <AnalyticsSidebar
                layers={state.layers}
                lengths={state.lengths}
                open={state.isSidebarOpen}
                location={state.area}
                lengthCalculationStrategy={state.lengthCalculationStrategy}
                debugMode={state.debugMode}
                isDarkMode={state.isDarkMode}
                toggle={handlers.toggleSidebar}
                onChangeStrategy={handlers.onChangeStrategy}
                downloadData={handlers.downloadData}
              />
            </aside>
          )}
        </main>
      </div>

      <CitySwitcherModal />

      {!(IS_MOBILE && state.isDirectionsPanelOpen) && (
        <nav aria-label="Camadas do mapa">
          <LayersBar
            layers={state.layers}
            onLayersChange={handlers.onLayersChange}
            embedMode={state.embedMode}
            isDarkMode={state.isDarkMode}
            openLayersLegendModal={handlers.openLayersLegendModal}
          />
        </nav>
      )}

      <aside aria-label="Painel de camadas">
        <LayersPanel
          layers={state.layers}
          lengths={state.lengths}
          onLayersChange={handlers.onLayersChange}
          embedMode={state.embedMode}
          isDarkMode={state.isDarkMode}
        />
      </aside>

      <aside aria-label="Painel de rotas">
        <DirectionsPanel
          ref={handlers.setDirectionsPanelRef}
          embedMode={state.embedMode}
          map={state.map}
          geoJson={state.geoJson}
          layers={state.layers}
          area={state.area}
          fromPoint={state.fromPoint}
          toPoint={state.toPoint}
          onFromPointChange={handlers.setFromPoint}
          onToPointChange={handlers.setToPoint}
          onClearRoutePoints={handlers.clearRoutePoints}
          onDirectionsPanelToggle={handlers.onDirectionsPanelToggle}
          isDarkMode={state.isDarkMode}
          debugMode={state.debugMode}
          onAreaChange={handlers.setArea}
          openLayersLegendModal={handlers.openLayersLegendModal}
        />
      </aside>

      <AboutModal
        visible={state.aboutModal}
        onClose={handlers.closeAboutModal}
        openLayersLegendModal={handlers.openLayersLegendModal}
      />

      <LayersLegendModal
        visible={state.layersLegendModal}
        onClose={handlers.closeLayersLegendModal}
        layers={state.layers}
        isDarkMode={state.isDarkMode}
        scrollToSection={state.layersLegendScrollToSection}
      />
    </div>
  );
}
