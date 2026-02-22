// Shared utilities for route calculations and formatting

import React from 'react';
import { MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY } from './constants.js';
import InfrastructureBadge from './InfrastructureBadge.js';

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
    
    if (totalCoverage === 0) {
        return { score: 0, cssClass: 'bg-red-600' };
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
    
    const getInfrastructureType = (item) => {
        if (item.includes('ciclovia')) return 'ciclovia';
        if (item.includes('calçada')) return 'calçada';
        if (item.includes('ciclofaixa')) return 'ciclofaixa';
        if (item.includes('ciclorrota')) return 'ciclorrota';
        if (item.includes('rua')) return 'rua';
        return null;
    };

    return (
        <div className="flex flex-wrap gap-1 "> {
            breakdown.map((item, index) => (
                <InfrastructureBadge
                    key={index}
                    infrastructure={getInfrastructureType(item)}
                    isDarkMode={isDarkMode}
                >
                    {item}
                </InfrastructureBadge>
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