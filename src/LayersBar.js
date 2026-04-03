import React, { Component } from 'react';
import { IS_MOBILE, TOPBAR_HEIGHT } from './config/constants.js';

import bikeparkingIcon from './img/icons/poi-bikeparking-mini.png';
import bikeparkingIconLight from './img/icons/poi-bikeparking-mini--light.png';
import bikeshopIcon from './img/icons/poi-bikeshop-mini.png';
import bikeshopIconLight from './img/icons/poi-bikeshop-mini--light.png';
import bikerentalIcon from './img/icons/poi-bikerental-mini.png';
import bikerentalIconLight from './img/icons/poi-bikerental-mini--light.png';
import { HiOutlineInformationCircle } from 'react-icons/hi';

import './LayersBar.css';

class LayersBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      outrasExpanded: false,
      pontosExpanded: false,
      ciclowaysExpanded: false,
      outrasAnimating: false,
      pontosAnimating: false,
      ciclowaysAnimating: false,
      outrasExpanding: false,
      pontosExpanding: false,
      ciclowaysExpanding: false,
    };
  }

  getActiveLayers() {
    const { layers } = this.props;
    return layers.filter((l) => !l.onlyDebug);
  }

  getLayerCategories() {
    const activeLayers = this.getActiveLayers();

    const categories = {
      pontos: activeLayers.filter((l) => l.type === 'poi'),
      cicloways: activeLayers.filter(
        (l) =>
          l.name === 'Ciclovia' ||
          l.name === 'Calçada compartilhada' ||
          l.name === 'Ciclofaixa' ||
          l.name === 'Ciclorrota'
      ),
      outras: activeLayers.filter(
        (l) => l.name === 'Baixa velocidade' || l.name === 'Trilha' || l.name === 'Proibido'
      ),
    };

    return categories;
  }

  // Category toggle method (kept for easy switching back)
  toggleCategory(category) {
    const { onLayersChange } = this.props;
    const categories = this.getLayerCategories();

    // Check if any layer in this category is active
    const hasActiveLayers = categories[category].some((layer) => layer.isActive);
    const newState = !hasActiveLayers;

    // Prepare batch update with all layers in this category
    const layerChanges = categories[category].map((layer) => ({
      id: layer.id,
      isActive: newState,
    }));

    // Call onLayersChange with batch update
    onLayersChange(layerChanges);
  }

  // Generic method to toggle expansion of any category
  toggleCategoryExpansion(categoryName) {
    const { onLayersChange } = this.props;
    const categories = this.getLayerCategories();
    const stateKey = `${categoryName}Expanded`;
    const animatingKey = `${categoryName}Animating`;
    const expandingKey = `${categoryName}Expanding`;

    this.setState(
      (prevState) => {
        const newExpanded = !prevState[stateKey];

        // If expanding, mark as expanding and delay layer activation
        if (newExpanded) {
          // Delay activation to allow pill exit animation
          setTimeout(() => {
            const layerChanges = categories[categoryName].map((layer) => ({
              id: layer.id,
              isActive: true,
            }));
            onLayersChange(layerChanges);

            // After layers are active, stop showing the expanding pill
            setTimeout(() => {
              this.setState({ [expandingKey]: false });
            }, 50);
          }, 300);

          return {
            [stateKey]: newExpanded,
            [animatingKey]: true,
            [expandingKey]: true,
          };
        }

        return {
          [stateKey]: newExpanded,
          [animatingKey]: true,
        };
      },
      () => {
        // Reset animation state after animation completes
        setTimeout(() => {
          this.setState({ [animatingKey]: false });
        }, 400);
      }
    );
  }

  // Generic method to toggle individual layer in any category
  toggleCategoryLayer(categoryName, layerId) {
    const { onLayersChange } = this.props;
    const currentLayer = this.props.layers.find((l) => l.id === layerId);
    const newActiveState = !currentLayer?.isActive;
    const stateKey = `${categoryName}Expanded`;
    const animatingKey = `${categoryName}Animating`;

    onLayersChange(layerId, newActiveState);

    // If turning off a layer, check if all layers are now deactivated
    if (!newActiveState) {
      setTimeout(() => {
        const updatedCategories = this.getLayerCategories();
        const allDeactivated = updatedCategories[categoryName].every((layer) => !layer.isActive);

        if (allDeactivated && this.state[stateKey]) {
          this.setState(
            {
              [stateKey]: false,
              [animatingKey]: true,
            },
            () => {
              // Reset animation state after animation completes
              setTimeout(() => {
                this.setState({ [animatingKey]: false });
              }, 3000);
            }
          );
        }
      }, 0);
    }
  }

  isCategoryActive(category) {
    const categories = this.getLayerCategories();
    return categories[category].some((layer) => layer.isActive);
  }

  getPOIIcon(iconName, isDarkMode) {
    const iconsMap = {
      'poi-bikeparking': isDarkMode ? bikeparkingIcon : bikeparkingIconLight,
      'poi-bikeshop': isDarkMode ? bikeshopIcon : bikeshopIconLight,
      'poi-rental': isDarkMode ? bikerentalIcon : bikerentalIconLight,
    };
    return iconsMap[iconName] || null;
  }

  renderLineStyle(style) {
    if (!style) return {};

    const background =
      style.lineStyle === 'solid'
        ? style.lineColor
        : `repeating-linear-gradient(90deg, ${style.lineColor}, ${style.lineColor} 4px, transparent 3px, transparent 6px)`;

    return {
      background,
      // height: `${Math.max(2, style.lineWidth / 2)}px`
    };
  }

  renderLayerButton({
    id,
    onClick,
    isActive,
    icon,
    lineStyle,
    label,
    className = '',
    shouldMergeWithNext = false,
    isAnimated = false,
    isCategoryPill = false,
    isExpanding = false,
  }) {
    const baseClasses =
      'cm-layersbar__pill flex items-center space-x-2 px-3 py-2 rounded-full text-xs transition-all duration-200 glass-bg flex-shrink-0';
    const activeClasses = isActive ? 'text-white bg-black bg-opacity-50' : 'text-gray-500';
    const animationClasses = isAnimated
      ? isCategoryPill
        ? isExpanding
          ? 'animate-category-expand'
          : 'animate-category-collapse'
        : 'animate-slide-in'
      : '';
    const mergeClasses = shouldMergeWithNext ? 'cm-layersbar__pill--merge-next' : '';

    const style = shouldMergeWithNext
      ? {
          marginRight: '-18px',
          borderTopRightRadius: '0',
          borderBottomRightRadius: '0',
          paddingRight: '16px',
        }
      : {};

    return (
      <button
        key={id}
        onClick={onClick}
        className={`${baseClasses} ${activeClasses} ${animationClasses} ${mergeClasses} ${className}`}
        style={style}
      >
        {(icon || lineStyle) && (
          <span
            className="flex"
            style={{
              opacity: isActive ? 1 : 0,
              maxWidth: isActive ? '1rem' : 0,
              marginRight: isActive ? 0 : '-0.5rem',
              transition: 'all 200ms ease-out',
            }}
          >
            {icon ? (
              <img className="w-3 h-3" src={icon} alt="" />
            ) : lineStyle ? (
              <span className="w-4 h-1 rounded" style={this.renderLineStyle(lineStyle)} />
            ) : null}
          </span>
        )}
        <span>{label}</span>
      </button>
    );
  }

  render() {
    const { layers, embedMode, isDarkMode } = this.props;

    if (!IS_MOBILE || !layers || embedMode) {
      return null;
    }

    const categories = this.getLayerCategories();

    const categoryConfig = {
      pontos: {
        icon: isDarkMode ? bikeparkingIcon : bikeparkingIconLight,
        label: 'Pontos de interesse',
      },
      cicloways: {
        label: 'Vias cicláveis',
      },
      outras: {
        label: 'Outras vias',
      },
    };

    return (
      <div
        className="cm-layersbar__container fixed left-0 right-0 px-2 overflow-scroll"
        style={{
          top: `${TOPBAR_HEIGHT - 8}px`,
          scrollbarWidth: 'none',
        }}
      >
        <div className="flex justify-start space-x-1 transition-all duration-300">
          {/* Cicloways category button (only when all cycleways are deactivated) */}
          {(() => {
            const config = categoryConfig.cicloways;
            const hasLayers = categories.cicloways.length > 0;
            const allLayersDeactivated =
              hasLayers && categories.cicloways.every((layer) => !layer.isActive);

            if (!hasLayers || !allLayersDeactivated) return null;

            return this.renderLayerButton({
              id: 'cicloways',
              onClick: () => this.toggleCategoryExpansion('cicloways'),
              isActive: false,
              icon: config.icon,
              lineStyle: config.style,
              label: config.label,
              isAnimated: this.state.ciclowaysAnimating,
              isCategoryPill: true,
            });
          })()}

          {/* Individual Cicloways layers - show when any are active or when expanded */}
          {(() => {
            const hasActiveCiclowaysLayers = categories.cicloways.some((layer) => layer.isActive);
            const shouldShowIndividual = hasActiveCiclowaysLayers || this.state.ciclowaysExpanded;

            if (!shouldShowIndividual) return null;

            return categories.cicloways.map((layer, index) => {
              const shouldMergeWithNext = index < categories.cicloways.length - 1;

              return this.renderLayerButton({
                id: layer.id,
                onClick: () => this.toggleCategoryLayer('cicloways', layer.id),
                isActive: layer.isActive,
                lineStyle: layer.style,
                label: layer.shortName || layer.displayName || layer.name,
                shouldMergeWithNext,
                isAnimated: this.state.ciclowaysAnimating,
              });
            });
          })()}

          {/* Pontos category button (only when all POI are deactivated or when expanding) */}
          {(() => {
            const config = categoryConfig.pontos;
            const hasLayers = categories.pontos.length > 0;
            const allLayersDeactivated =
              hasLayers && categories.pontos.every((layer) => !layer.isActive);

            if (!hasLayers || (!allLayersDeactivated && !this.state.pontosExpanding)) return null;

            return this.renderLayerButton({
              id: 'pontos',
              onClick: () => this.toggleCategoryExpansion('pontos'),
              isActive: false,
              icon: config.icon,
              lineStyle: config.style,
              label: config.label,
              isAnimated: this.state.pontosAnimating,
              isCategoryPill: true,
              isExpanding: this.state.pontosExpanding,
            });
          })()}

          {/* Individual Pontos layers - show when any are active or when expanded */}
          {(() => {
            const hasActivePontosLayers = categories.pontos.some((layer) => layer.isActive);
            const shouldShowIndividual = hasActivePontosLayers || this.state.pontosExpanded;

            if (!shouldShowIndividual) return null;

            return categories.pontos.map((layer, index) => {
              const shouldMergeWithNext = index < categories.pontos.length - 1;

              return this.renderLayerButton({
                id: layer.id,
                onClick: () => this.toggleCategoryLayer('pontos', layer.id),
                isActive: layer.isActive,
                icon: this.getPOIIcon(layer.icon, isDarkMode),
                lineStyle: layer.style,
                label: layer.shortName || layer.displayName || layer.name,
                shouldMergeWithNext,
                isAnimated: this.state.pontosAnimating,
              });
            });
          })()}

          {/* Outras category button (last) */}
          {(() => {
            const config = categoryConfig.outras;
            const hasLayers = categories.outras.length > 0;
            const allLayersDeactivated =
              hasLayers && categories.outras.every((layer) => !layer.isActive);

            // Only show Outras button if all layers are deactivated
            if (!hasLayers || !allLayersDeactivated) return null;

            return this.renderLayerButton({
              id: 'outras',
              onClick: () => this.toggleCategoryExpansion('outras'),
              isActive: false, // Always false since we only show when all are deactivated
              icon: config.icon,
              lineStyle: config.style,
              label: config.label,
              isAnimated: this.state.outrasAnimating,
              isCategoryPill: true,
            });
          })()}

          {/* Individual Outras layers - show when any are active or when expanded */}
          {(() => {
            const hasActiveOutrasLayers = categories.outras.some((layer) => layer.isActive);
            const shouldShowIndividual = hasActiveOutrasLayers || this.state.outrasExpanded;

            if (!shouldShowIndividual) return null;

            return categories.outras.map((layer, index) => {
              const displayName = layer.displayName || layer.name;
              const shouldMergeWithNext = index < categories.outras.length - 1;

              return this.renderLayerButton({
                id: layer.id,
                onClick: () => this.toggleCategoryLayer('outras', layer.id),
                isActive: layer.isActive,
                lineStyle: layer.style,
                label: displayName,
                className: 'ml-2',
                shouldMergeWithNext,
                isAnimated: this.state.outrasAnimating,
              });
            });
          })()}

          {/* Legend info icon */}
          <button
            onClick={this.props.openLayersLegendModal}
            className="flex items-center justify-center ml-2 px-2 py-2 rounded-full text-xs transition-all duration-200 glass-bg flex-shrink-0 gap-1"
          >
            <HiOutlineInformationCircle className="text-base" /> Legenda
          </button>
        </div>
      </div>
    );
  }
}

export default LayersBar;
