import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { DirectionsData } from '../types/directions';
import { DIRECTIONS_MAX_RESULTS } from '../config/constants.js';

export interface DirectionsContextValue {
  directions: DirectionsData | null;
  selectedRouteIndex: number | null;
  hoveredRouteIndex: number | null;
  directionsLoading: boolean;
  directionsError: unknown;
  isSettingRoutePoints: boolean;
  isInRouteMode: boolean;
  setRoutePointsMode: (isSetting: boolean) => void;
  clearDirections: () => void;
  selectRoute: (routeIndex: number | null) => void;
  hoverRoute: (routeIndex: number | null) => void;
  setDirectionsData: (data: DirectionsData, options?: { preserveSelection?: boolean }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: unknown) => void;
  maxRoutesShown: number;
  visibleRouteIndices: number[] | null;
  setVisibleRouteIndices: (indices: number[] | null) => void;
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
  const [visibleRouteIndices, setVisibleRouteIndices] = useState<number[] | null>(null);
  const [elevationHoverLngLat, setElevationHoverLngLat] = useState<[number, number] | null>(null);
  const maxRoutesShown = DIRECTIONS_MAX_RESULTS;

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
      setRoutePointsMode,
      clearDirections,
      selectRoute,
      hoverRoute,
      setDirectionsData,
      setLoading,
      setError,
      maxRoutesShown,
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
