import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { DirectionsData } from '../types/directions';

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
  setRoutePointsMode: (isSetting: boolean) => void;
  clearDirections: () => void;
  selectRoute: (routeIndex: number | null) => void;
  hoverRoute: (routeIndex: number | null) => void;
  setDirectionsData: (data: DirectionsData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: unknown) => void;
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

  const isInRouteMode = useMemo(() => {
    const hasActiveRoutes = Boolean(directions?.routes?.length);
    return Boolean(hasActiveRoutes || isSettingRoutePoints);
  }, [directions, isSettingRoutePoints]);

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
  }, []);

  const selectRoute = useCallback((routeIndex: number | null) => {
    setSelectedRouteIndex(routeIndex);
  }, []);

  const hoverRoute = useCallback((routeIndex: number | null) => {
    setHoveredRouteIndex(routeIndex);
  }, []);

  const setDirectionsData = useCallback((data: DirectionsData) => {
    setDirections(data);
    setSelectedRouteIndex(data.routes.length > 0 ? 0 : null);
    setDirectionsError(null);
    setDirectionsLoading(false);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setDirectionsLoading(loading);
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
    ]
  );

  return <DirectionsContext.Provider value={value}>{children}</DirectionsContext.Provider>;
};
