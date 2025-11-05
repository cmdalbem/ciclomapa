import React from 'react';
import { hexToRgba, adjustColorBrightness } from './utils.js';
import * as layersDefinitions from './layers.json';
import { ROUTE_COLORS } from './constants.js';

const getLayerColors = () => {
    const layers = layersDefinitions.default;
    const colors = {};
    
    layers.forEach(layer => {
        if (layer.style && layer.style.lineColor) {
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

const InfrastructureBadge = ({ 
    children, 
    infrastructure,
    isDarkMode = false
}) => {
    const layerColors = getLayerColors();
    
    let textColor;
    let backgroundColor;
    
    if (infrastructure === 'rua') {
        const routeColor = isDarkMode ? ROUTE_COLORS.DARK.SELECTED : ROUTE_COLORS.LIGHT.SELECTED;
        textColor = isDarkMode ? 'white' : adjustColorBrightness(routeColor, -0.3);
        backgroundColor = hexToRgba(routeColor, isDarkMode ? 0.6 : 0.2);
    } else if (infrastructure) {
        const badgeColor = layerColors[infrastructure];
        if (badgeColor) {
            if (infrastructure === 'ciclovia' || infrastructure === 'calçada') {
                textColor = isDarkMode ? 'black' : adjustColorBrightness(badgeColor, -0.2);
                backgroundColor = hexToRgba(badgeColor, isDarkMode ? 0.9 : 0.22);
            } else if (infrastructure === 'ciclofaixa' || infrastructure === 'ciclorrota') {
                textColor = isDarkMode ? 'white' : adjustColorBrightness(badgeColor, -0.5);
                backgroundColor = hexToRgba(badgeColor, isDarkMode ? 0.4 : 0.2);
            }
        }
    }
    
    if (!textColor || !backgroundColor) {
        return null;
    }
    
    return (
        <span
            className="rounded-full font-medium text-xs px-1 py-0.5 flex items-center gap-1"
            style={{
                color: textColor,
                backgroundColor: backgroundColor
            }}
        >
            {children}
        </span>
    );
};

export default InfrastructureBadge;

