// Shared utilities for route calculations and formatting

import { MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY, ROUTE_COLORS } from './constants.js';
import { hexToRgba, adjustColorBrightness } from './utils.js';
import * as layersDefinitions from './layers.json';

// Get layer colors from layers.json configuration
const getLayerColors = () => {
    const layers = layersDefinitions.default;
    const colors = {};
    
    layers.forEach(layer => {
        if (layer.style && layer.style.lineColor) {
            // Map layer names to their colors
            if (layer.name === 'Ciclovia') {
                colors.ciclovia = layer.style.lineColor;
            } else if (layer.name === 'Ciclofaixa') {
                colors.ciclofaixa = layer.style.lineColor;
            } else if (layer.name === 'Ciclorrota') {
                colors.ciclorrota = layer.style.lineColor;
            } else if (layer.name === 'Calçada compartilhada') {
                colors.calçada = layer.style.lineColor;
            }
        }
    });
    
    return colors;
};

export const getRouteScore = (routeCoverageData, index) => {
    // Handle both old array format and new unified format
    let route;
    if (Array.isArray(routeCoverageData)) {
        // Old format: array with index
        if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
            return { score: null, cssClass: null };
        }
        route = routeCoverageData[index];
    } else {
        // New format: direct route object
        if (!routeCoverageData || !routeCoverageData.coverageByType) {
            return { score: null, cssClass: null };
        }
        route = routeCoverageData;
    }
    
    const coverageByType = route.coverageByType;
    
    // Infrastructure quality weights (higher = better)
    const qualityWeights = {
        'Ciclovia': 1.0,
        'Calçada compartilhada': 0.8,
        'Ciclofaixa': 0.6,
        'Ciclorrota': 0.4
    };
    
    // Calculate weighted score
    let weightedScore = 0;
    let totalCoverage = 0;
    
    Object.keys(coverageByType).forEach(type => {
        const percentage = coverageByType[type];
        const weight = qualityWeights[type] || 0;
        weightedScore += percentage * weight;
        totalCoverage += percentage;
    });
    
    // If no cycling infrastructure coverage, score is 0
    if (totalCoverage === 0) {
        return { score: 0, cssClass: 'bg-gray-600' };
    }
    
    // Calculate final score considering BOTH quality and coverage
    // The score should be: (weighted average quality) * (actual route coverage percentage)
    const weightedAverage = weightedScore / totalCoverage; // Quality score (0-1)
    const routeCoveragePercentage = route.coverage || 0; // Actual coverage % (0-100)
    const finalScore = Math.round(weightedAverage * routeCoveragePercentage);
    
    // Determine CSS class based on score
    let cssClass;
    if (finalScore < 50) {
        cssClass = 'bg-red-600';
    } else if (finalScore < 75) {
        cssClass = 'bg-yellow-600';
    } else {
        cssClass = 'bg-green-600';
    }   
    return { score: finalScore, cssClass: cssClass };
};

export const getCoverageBreakdown = (routeCoverageData, index, isDarkMode) => {
    // Handle both old array format and new unified format
    let route;
    if (Array.isArray(routeCoverageData)) {
        // Old format: array with index
        if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
            return [];
        }
        route = routeCoverageData[index];
    } else {
        // New format: direct route object
        if (!routeCoverageData || !routeCoverageData.coverageByType) {
            return [];
        }
        route = routeCoverageData;
    }
    
    const coverageByType = route.coverageByType;
    const breakdown = [];
    
    const typeNames = {
        'Ciclovia': 'ciclovia',
        'Ciclofaixa': 'ciclofaixa', 
        'Ciclorrota': 'ciclorrota',
        'Calçada compartilhada': 'calçada'
    };

    let totalPercentage = 100;
    
    Object.keys(coverageByType).forEach(type => {
        const percentage = coverageByType[type];
        if (percentage > MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY) {
            const shortName = typeNames[type] || type.toLowerCase();
            breakdown.push(`${percentage.toFixed(0)}% ${shortName}`);
            totalPercentage -= percentage;
        }
    });

    if (totalPercentage > 0) {
        breakdown.push(`${totalPercentage.toFixed(0)}% rua`);
    }
    
    const layerColors = getLayerColors();
    
    return (
        <div className="flex flex-wrap gap-1 "> {
            breakdown.map((item, index) => (
                <span
                    key={index}
                    className={`text-xs rounded-md px-1 py-0.5`}
                    style={{
                        color: 
                            isDarkMode ? 'white' 
                            : item.includes('ciclovia') ? layerColors.ciclovia
                            : item.includes('calçada') ? layerColors.calçada
                            : item.includes('ciclofaixa') ? adjustColorBrightness(layerColors.ciclofaixa, -0.5)
                            : item.includes('ciclorrota') ? adjustColorBrightness(layerColors.ciclorrota, -0.5)
                            : adjustColorBrightness(ROUTE_COLORS.LIGHT.SELECTED, -0.2),
                        backgroundColor: 
                            item.includes('ciclovia') ? hexToRgba(layerColors.ciclovia, isDarkMode ? 0.3 : 0.1)
                            : item.includes('calçada') ? hexToRgba(layerColors.calçada, isDarkMode ? 0.3 : 0.1)
                            : item.includes('ciclofaixa') ? hexToRgba(layerColors.ciclofaixa, isDarkMode ? 0.5 : 0.3)
                            : item.includes('ciclorrota') ? hexToRgba(layerColors.ciclorrota, isDarkMode ? 0.5 : 0.3)
                            : isDarkMode ? hexToRgba(ROUTE_COLORS.DARK.SELECTED, 0.6) : hexToRgba(ROUTE_COLORS.LIGHT.SELECTED, 0.2)
                    }}
                >
                    {item}
                </span>
            ))}
        </div>
    );
};

export const getCoverageBreakdownSimple = (routeCoverageData, index) => {
    // Handle both old array format and new unified format
    let route;
    if (Array.isArray(routeCoverageData)) {
        // Old format: array with index
        if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
            return null;
        }
        route = routeCoverageData[index];
    } else {
        // New format: direct route object
        if (!routeCoverageData || !routeCoverageData.coverageByType) {
            return null;
        }
        route = routeCoverageData;
    }
    
    const coverageByType = route.coverageByType;
    const breakdown = [];
    
    // Map infrastructure type names to shorter display names
    const typeNames = {
        'Ciclovia': 'ciclovia',
        'Ciclofaixa': 'ciclofaixa', 
        'Ciclorrota': 'ciclorrota',
        'Calçada compartilhada': 'calçada'
    };
    
    Object.keys(coverageByType).forEach(type => {
        const percentage = coverageByType[type];
        if (percentage > MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY) {
            const shortName = typeNames[type] || type.toLowerCase();
            breakdown.push(`${percentage.toFixed(0)}% ${shortName}`);
        }
    });
    
    return (
        <span className="text-xs text-gray-400">
            {breakdown.join('∙')}
        </span>
    );
};

export const formatDistance = (distance) => {
    if (!distance) return 'N/A';
    return `${(distance / 1000).toFixed(1)} km`;
};

export const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    return `${Math.round(duration / 60)} min`;
};