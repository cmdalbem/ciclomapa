/**
 * Layout component for the main app shell: header, main (map), asides, modals.
 * Receives state and handlers from App to keep App.js focused on state and logic.
 */
import React from 'react';
import PropTypes from 'prop-types';
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
import ApiDebugOverlay from './dev/ApiDebugOverlay.jsx';

export default function AppLayout({
  state,
  handlers,
  directionsPanelRef,
  seoPageTitle,
  cityCanonicalSlug,
}) {
  return (
    <div
      id="ciclomapa"
      className={[
        state.hideUI || state.hideUIFromUrl ? 'hideUI' : '',
        state.isSidebarOpen ? 'analyticsSidebarOpen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h1 className="sr-only">{seoPageTitle}</h1>
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
                debugMode={state.debugMode}
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
            globalSearchPin={state.globalSearchPin}
            onGlobalSearchPinDismiss={handlers.clearGlobalSearchPin}
            favorites={state.favorites}
            onFavoritesChanged={handlers.handleFavoritesChanged}
            cleanMode={state.cleanMode}
          />

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
                cityMetadata={state.airtableCityFields}
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

      <CitySwitcherModal
        mapCenter={
          typeof state.lat === 'number' && typeof state.lng === 'number'
            ? { lat: state.lat, lng: state.lng }
            : null
        }
        onPlacesResultSelected={handlers.handleGlobalSearchPlaceSelect}
        onCatalogCityPicked={handlers.clearGlobalSearchPin}
        onFavoritesChanged={handlers.handleFavoritesChanged}
      />

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
          openLayersLegendModal={handlers.openLayersLegendModal}
        />
      </aside>

      {!state.embedMode && (
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
      )}

      <AboutModal
        visible={state.aboutModal}
        onClose={handlers.closeAboutModal}
        openLayersLegendModal={handlers.openLayersLegendModal}
        openCityPicker={handlers.openCityPicker}
        embedMode={state.embedMode}
        isDarkMode={state.isDarkMode}
        cityCanonicalSlug={cityCanonicalSlug}
        lengths={state.lengths}
        layers={state.layers}
        mapDataLoading={state.loading}
        mapHasGeoJson={state.geoJson != null}
      />

      <LayersLegendModal
        visible={state.layersLegendModal}
        onClose={handlers.closeLayersLegendModal}
        layers={state.layers}
        isDarkMode={state.isDarkMode}
        scrollToSection={state.layersLegendScrollToSection}
      />

      {state.debugMode && <ApiDebugOverlay />}
    </div>
  );
}

AppLayout.propTypes = {
  seoPageTitle: PropTypes.string,
  cityCanonicalSlug: PropTypes.string,
  directionsPanelRef: PropTypes.object,
  state: PropTypes.shape({
    hideUI: PropTypes.bool,
    hideUIFromUrl: PropTypes.bool,
    isSidebarOpen: PropTypes.bool,
    isDirectionsPanelOpen: PropTypes.bool,
    area: PropTypes.string,
    dataUpdatedAt: PropTypes.string,
    lat: PropTypes.number,
    lng: PropTypes.number,
    zoom: PropTypes.number,
    embedMode: PropTypes.bool,
    isDarkMode: PropTypes.bool,
    loading: PropTypes.bool,
    mapKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    debugMode: PropTypes.bool,
    geoJson: PropTypes.object,
    layers: PropTypes.array,
    mapStyle: PropTypes.string,
    showSatellite: PropTypes.bool,
    toPoint: PropTypes.object,
    fromPoint: PropTypes.object,
    isTrackingUserLocation: PropTypes.bool,
    globalSearchPin: PropTypes.object,
    favorites: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
    cleanMode: PropTypes.bool,
    lengths: PropTypes.object,
    airtableCityFields: PropTypes.object,
    lengthCalculationStrategy: PropTypes.string,
    map: PropTypes.object,
    aboutModal: PropTypes.bool,
    layersLegendModal: PropTypes.bool,
    layersLegendScrollToSection: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  handlers: PropTypes.shape({
    downloadData: PropTypes.func,
    onMapMoved: PropTypes.func,
    forceUpdate: PropTypes.func,
    toggleSidebar: PropTypes.func,
    openAboutModal: PropTypes.func,
    toggleTheme: PropTypes.func,
    updateLengths: PropTypes.func,
    setMapRef: PropTypes.func,
    onTrackingUserLocationChange: PropTypes.func,
    clearGlobalSearchPin: PropTypes.func,
    handleFavoritesChanged: PropTypes.func,
    onLayersChange: PropTypes.func,
    openLayersLegendModal: PropTypes.func,
    handleGlobalSearchPlaceSelect: PropTypes.func,
    setDirectionsPanelRef: PropTypes.func,
    setFromPoint: PropTypes.func,
    setToPoint: PropTypes.func,
    clearRoutePoints: PropTypes.func,
    onDirectionsPanelToggle: PropTypes.func,
    setArea: PropTypes.func,
    closeAboutModal: PropTypes.func,
    openCityPicker: PropTypes.func,
    closeLayersLegendModal: PropTypes.func,
    onChangeStrategy: PropTypes.func,
  }).isRequired,
};
