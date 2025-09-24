import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Context for managing directions/route state across components
 * Eliminates prop drilling between DirectionsPanel, App, and Map
 */
const DirectionsContext = createContext();

export const useDirections = () => {
    const context = useContext(DirectionsContext);
    if (!context) {
        throw new Error('useDirections must be used within a DirectionsProvider');
    }
    return context;
};

export const DirectionsProvider = ({ children }) => {
    // Core directions state
    const [directions, setDirections] = useState(null);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
    const [hoveredRouteIndex, setHoveredRouteIndex] = useState(null);
    const [routeCoverageData, setRouteCoverageData] = useState([]);
    const [directionsLoading, setDirectionsLoading] = useState(false);
    const [directionsError, setDirectionsError] = useState(null);
    
    // Route mode state
    const [isSettingRoutePoints, setIsSettingRoutePoints] = useState(false);

    // Computed values
    const isInRouteMode = useMemo(() => {
        const hasActiveRoutes = directions && 
                               directions.routes && 
                               directions.routes.length > 0;
        return hasActiveRoutes || isSettingRoutePoints;
    }, [directions, isSettingRoutePoints]);

    // Actions
    const setRoutePointsMode = useCallback((isSetting) => {
        setIsSettingRoutePoints(isSetting);
    }, []);

    const clearDirections = useCallback(() => {
        setDirections(null);
        setSelectedRouteIndex(null);
        setHoveredRouteIndex(null);
        setRouteCoverageData([]);
        setDirectionsError(null);
        setDirectionsLoading(false);
        setIsSettingRoutePoints(false);
    }, []);

    const selectRoute = useCallback((routeIndex) => {
        setSelectedRouteIndex(routeIndex);
    }, []);

    const hoverRoute = useCallback((routeIndex) => {
        setHoveredRouteIndex(routeIndex);
    }, []);

    const setDirectionsData = useCallback((data) => {
        setDirections(data.directions);
        setRouteCoverageData(data.routeCoverageData || []);
        setSelectedRouteIndex(0);
        setDirectionsError(null);
        setDirectionsLoading(false);
    }, []);

    const setLoading = useCallback((loading) => {
        setDirectionsLoading(loading);
    }, []);

    const setError = useCallback((error) => {
        setDirectionsError(error);
        // Only set loading to false if there's an actual error (not null)
        if (error !== null) {
            setDirectionsLoading(false);
        }
    }, []);

    const value = {
        // State
        directions,
        selectedRouteIndex,
        hoveredRouteIndex,
        routeCoverageData,
        directionsLoading,
        directionsError,
        isSettingRoutePoints,
        isInRouteMode,
        
        // Actions
        setRoutePointsMode,
        clearDirections,
        selectRoute,
        hoverRoute,
        setDirectionsData,
        setLoading,
        setError
    };

    return (
        <DirectionsContext.Provider value={value}>
            {children}
        </DirectionsContext.Provider>
    );
};
