// Shared utilities for route calculations and formatting

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
    if (finalScore >= 80) cssClass = 'bg-green-600';
    else if (finalScore >= 60) cssClass = 'bg-yellow-600';
    else if (finalScore >= 40) cssClass = 'bg-orange-600';
    else cssClass = 'bg-red-600';
    
    return { score: finalScore, cssClass };
};

export const getCoverageBreakdown = (routeCoverageData, index) => {
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
        if (percentage > 1) {
            const shortName = typeNames[type] || type.toLowerCase();
            breakdown.push(`${percentage.toFixed(0)}% ${shortName}`);
            totalPercentage -= percentage;
        }
    });

    if (totalPercentage > 0) {
        breakdown.push(`${totalPercentage.toFixed(0)}% rua`);
    }
    
    return (
        <div className="flex flex-wrap gap-1 mt-1"> {
            breakdown.map((item, index) => (
                <span
                    key={index}
                    className="text-xs bg-white bg-opacity-10 text-white rounded-md px-1 py-0.5"
                    style={{
                        backgroundColor: 
                            item.includes('ciclovia') ? '#4A5D5A'
                            : item.includes('ciclofaixa') ? '#6B7A6B'
                            : item.includes('calçada') ? '#7A7568'
                            : item.includes('ciclorrota') ? '#7A6B6A'
                            : '#FF9999'
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