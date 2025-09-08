// Shared utilities for route calculations and formatting

export const getRouteScore = (routeCoverageData, index) => {
    if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
        return { score: null, cssClass: null };
    }
    
    const coverageByType = routeCoverageData[index].coverageByType;
    
    // Infrastructure quality weights (higher = better)
    const qualityWeights = {
        'Ciclovia': 1.0,           // Perfect score
        'Ciclofaixa': 0.8,         // Good but not perfect
        'Ciclorrota': 0.6,         // Moderate quality
        'Calçada compartilhada': 0.4  // Lower quality
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
        return { score: 0, cssClass: 'bg-red-600' };
    }
    
    // Normalize score to 0-100 range
    const score = Math.round(weightedScore);
    let cssClass;
    
    if (score < 50) {
        cssClass = 'bg-red-600';
    } else if (score < 75) {
        cssClass = 'bg-yellow-600';
    } else {
        cssClass = 'bg-green-600';
    }
    
    return { score, cssClass };
};

export const getCoverageBreakdownSimple = (routeCoverageData, index) => {
    if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
        return null;
    }
    
    const coverageByType = routeCoverageData[index].coverageByType;
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
        if (percentage > 1) {
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

export const getCoverageBreakdown = (routeCoverageData, index) => {
    if (!routeCoverageData || !routeCoverageData[index] || !routeCoverageData[index].coverageByType) {
        return [];
    }
    
    const coverageByType = routeCoverageData[index].coverageByType;
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
                            : item.includes('ciclorrota') ? '#7A7568'
                            : item.includes('calçada') ? '#7A6B6A'
                            : '#FF9999'
                    }}
                >
                    {item}
                </span>
            ))}
        </div>
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
