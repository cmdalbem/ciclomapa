import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { DirectionsData } from '../types/directions';
import {
  HYBRID_MAX_RESULTS,
  MAP_PMTILES_COMPARE_KINDS,
  MAP_PMTILES_POC_REGION_IDS,
} from '../config/constants.js';
import { getDirectionsProviderOptions, readDirectionsUrlParams } from '../utils/routeUtils.js';
/** Disposable São Paulo PMTiles maxzoom compare kinds. */
export type MapPmtilesKind = 'zg' | 'z13' | 'analysis';
/** Disposable PoC: off = normal env tiles; otherwise preset archives. */
export type MapPmtilesPocRegion = 'off' | 'sao-paulo' | 'brazil' | 'spain';

const MAP_PMTILES_POC_STORAGE_KEY = 'ciclomapa_mapPmtilesPoc:v1';

function initialMaxRoutesShown(): number {
  const fromUrl = readDirectionsUrlParams().maxRoutes;
  return fromUrl != null ? fromUrl : HYBRID_MAX_RESULTS;
}

function initialRoutingProvider(): string {
  const fromUrl = readDirectionsUrlParams().provider;
  const allowed = new Set(getDirectionsProviderOptions().map((o) => o.value));
  return fromUrl && allowed.has(fromUrl) ? fromUrl : 'hybrid';
}

function readStoredMapPmtilesPoc(): {
  region: MapPmtilesPocRegion;
  kind: MapPmtilesKind;
  laneOffset: boolean;
} {
  const defaults = {
    region: 'off' as MapPmtilesPocRegion,
    kind: 'z13' as MapPmtilesKind,
    laneOffset: false,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(MAP_PMTILES_POC_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const region = MAP_PMTILES_POC_REGION_IDS.includes(parsed?.region)
      ? (parsed.region as MapPmtilesPocRegion)
      : defaults.region;
    const kind = MAP_PMTILES_COMPARE_KINDS.includes(parsed?.kind)
      ? (parsed.kind as MapPmtilesKind)
      : defaults.kind;
    return {
      region,
      kind,
      laneOffset: Boolean(parsed?.laneOffset),
    };
  } catch {
    return defaults;
  }
}

/**
 * Context for managing directions/route state across components
 * Eliminates prop drilling between DirectionsPanel, App, and Map
 */

export interface DirectionsContextValue {
  directions: DirectionsData | null;
  selectedRouteIndex: number | null;
  hoveredRouteIndex: number | null;
  directionsLoading: boolean;
  directionsError: unknown;
  isSettingRoutePoints: boolean;
  isInRouteMode: boolean;
  /** Disposable compare aid: hide calculated route overlay so underlying cyclepaths show through. */
  hideRouteOverlay: boolean;
  setHideRouteOverlay: (hide: boolean) => void;
  /**
   * Disposable compare aid: paint the route as contiguous typed segments (street + infra)
   * instead of orange underlay + overlap stack.
   */
  segmentedRoutePaint: boolean;
  setSegmentedRoutePaint: (enabled: boolean) => void;
  /** Disposable compare aid: which São Paulo PMTiles archive the map paints. */
  mapPmtilesKind: MapPmtilesKind;
  setMapPmtilesKind: (kind: MapPmtilesKind) => void;
  /** Disposable PoC: Off (normal env tiles) / São Paulo / Spain. */
  mapPmtilesPocRegion: MapPmtilesPocRegion;
  setMapPmtilesPocRegion: (region: MapPmtilesPocRegion) => void;
  /**
   * Disposable compare aid: when true, cycleway:left/right lanes get line-offset
   * toward their tagged roadside. Temporarily defaults off so geometry sits on the way.
   */
  laneSideOffsetEnabled: boolean;
  setLaneSideOffsetEnabled: (enabled: boolean) => void;
  /** Which routing engine the panel / hybrid mix uses. */
  routingProvider: string;
  setRoutingProvider: (provider: string) => void;
  setRoutePointsMode: (isSetting: boolean) => void;
  clearDirections: () => void;
  selectRoute: (routeIndex: number | null) => void;
  hoverRoute: (routeIndex: number | null) => void;
  setDirectionsData: (data: DirectionsData, options?: { preserveSelection?: boolean }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: unknown) => void;
  /** Cap how many hybrid routes appear in the list and on the map. 0 = all. */
  maxRoutesShown: number;
  setMaxRoutesShown: (n: number) => void;
  /** Original indices into `directions.routes` that the panel is showing (drives map paint). */
  visibleRouteIndices: number[] | null;
  setVisibleRouteIndices: (indices: number[] | null) => void;
  /** Point along the selected route while scrubbing the elevation chart ([lng, lat]). */
  elevationHoverLngLat: [number, number] | null;
  setElevationHoverLngLat: (lngLat: [number, number] | null) => void;
}

const DirectionsContext = createContext<DirectionsContextValue | null>(null);

export const useDirections = (): DirectionsContextValue => {
  const context = useContext(DirectionsContext);
  if (!context) {
    throw new Error('useDirections must be used within a DirectionsProvider');
  }
  return context;
};

interface DirectionsProviderProps {
  children: React.ReactNode;
}

export const DirectionsProvider: React.FC<DirectionsProviderProps> = ({ children }) => {
  const [directions, setDirections] = useState<DirectionsData | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [hoveredRouteIndex, setHoveredRouteIndex] = useState<number | null>(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<unknown>(null);
  const [isSettingRoutePoints, setIsSettingRoutePoints] = useState(false);
  const [hideRouteOverlay, setHideRouteOverlay] = useState(false);
  const [segmentedRoutePaint, setSegmentedRoutePaint] = useState(false);
  const [mapPmtilesKind, setMapPmtilesKind] = useState<MapPmtilesKind>(() => {
    return readStoredMapPmtilesPoc().kind;
  });
  const [mapPmtilesPocRegion, setMapPmtilesPocRegion] = useState<MapPmtilesPocRegion>(() => {
    return readStoredMapPmtilesPoc().region;
  });
  const [laneSideOffsetEnabled, setLaneSideOffsetEnabled] = useState(() => {
    return readStoredMapPmtilesPoc().laneOffset;
  });
  const [maxRoutesShown, setMaxRoutesShown] = useState(initialMaxRoutesShown);
  const [routingProvider, setRoutingProvider] = useState(initialRoutingProvider);
  const [visibleRouteIndices, setVisibleRouteIndices] = useState<number[] | null>(null);
  const [elevationHoverLngLat, setElevationHoverLngLat] = useState<[number, number] | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MAP_PMTILES_POC_STORAGE_KEY,
        JSON.stringify({
          region: mapPmtilesPocRegion,
          kind: mapPmtilesKind,
          laneOffset: laneSideOffsetEnabled,
        })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [mapPmtilesPocRegion, mapPmtilesKind, laneSideOffsetEnabled]);

  const isInRouteMode = useMemo(() => {
    const hasActiveRoutes = Boolean(directions?.routes?.length);
    return Boolean(hasActiveRoutes || isSettingRoutePoints || directionsLoading);
  }, [directions, isSettingRoutePoints, directionsLoading]);

  const setRoutePointsMode = useCallback((isSetting: boolean) => {
    setIsSettingRoutePoints(isSetting);
  }, []);

  const clearDirections = useCallback(() => {
    setDirections(null);
    setSelectedRouteIndex(null);
    setHoveredRouteIndex(null);
    setDirectionsError(null);
    setDirectionsLoading(false);
    setIsSettingRoutePoints(false);
    setHideRouteOverlay(false);
    setSegmentedRoutePaint(false);
    setVisibleRouteIndices(null);
    setElevationHoverLngLat(null);
  }, []);

  const selectRoute = useCallback((routeIndex: number | null) => {
    setSelectedRouteIndex(routeIndex);
    setElevationHoverLngLat(null);
  }, []);

  const hoverRoute = useCallback((routeIndex: number | null) => {
    setHoveredRouteIndex(routeIndex);
  }, []);

  const setDirectionsData = useCallback(
    (data: DirectionsData, options?: { preserveSelection?: boolean }) => {
      setDirections(data);
      setSelectedRouteIndex((prev) => {
        if (options?.preserveSelection && prev != null && data.routes[prev]) {
          return prev;
        }
        return data.routes.length > 0 ? 0 : null;
      });
      setDirectionsError(null);
      setDirectionsLoading(false);
    },
    []
  );

  const setLoading = useCallback((loading: boolean) => {
    setDirectionsLoading(loading);
    if (loading) {
      setHideRouteOverlay(false);
      setDirections(null);
      setSelectedRouteIndex(null);
      setHoveredRouteIndex(null);
      setVisibleRouteIndices(null);
      setElevationHoverLngLat(null);
    }
  }, []);

  const setError = useCallback((error: unknown) => {
    setDirectionsError(error);
    if (error !== null) {
      setDirectionsLoading(false);
    }
  }, []);

  const value: DirectionsContextValue = useMemo(
    () => ({
      directions,
      selectedRouteIndex,
      hoveredRouteIndex,
      directionsLoading,
      directionsError,
      isSettingRoutePoints,
      isInRouteMode,
      hideRouteOverlay,
      setHideRouteOverlay,
      segmentedRoutePaint,
      setSegmentedRoutePaint,
      mapPmtilesKind,
      setMapPmtilesKind,
      mapPmtilesPocRegion,
      setMapPmtilesPocRegion,
      laneSideOffsetEnabled,
      setLaneSideOffsetEnabled,
      routingProvider,
      setRoutingProvider,
      setRoutePointsMode,
      clearDirections,
      selectRoute,
      hoverRoute,
      setDirectionsData,
      setLoading,
      setError,
      maxRoutesShown,
      setMaxRoutesShown,
      visibleRouteIndices,
      setVisibleRouteIndices,
      elevationHoverLngLat,
      setElevationHoverLngLat,
    }),
    [
      directions,
      selectedRouteIndex,
      hoveredRouteIndex,
      directionsLoading,
      directionsError,
      isSettingRoutePoints,
      isInRouteMode,
      hideRouteOverlay,
      segmentedRoutePaint,
      mapPmtilesKind,
      mapPmtilesPocRegion,
      laneSideOffsetEnabled,
      routingProvider,
      setRoutePointsMode,
      clearDirections,
      selectRoute,
      hoverRoute,
      setDirectionsData,
      setLoading,
      setError,
      maxRoutesShown,
      visibleRouteIndices,
      elevationHoverLngLat,
    ]
  );

  return <DirectionsContext.Provider value={value}>{children}</DirectionsContext.Provider>;
};
