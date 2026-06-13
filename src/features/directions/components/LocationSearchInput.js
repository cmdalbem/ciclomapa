import React from 'react';
import { AutoComplete, Button, Input, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { MdGpsFixed as IconGPS } from 'react-icons/md';
import { HiSearch as IconSearch, HiX as IconClear, HiHeart as IconHeart } from 'react-icons/hi';

import { ENABLE_MAP_CLICK_TO_SET_POINTS } from '../../../config/constants.js';
import { PlacesAutocompleteOptionLabel } from '../../../GooglePlacesGeocoder.js';
import { PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH } from '../../../placesAutocomplete.js';

function FavoriteAutocompleteOptionLabel({ suggestion }) {
  const props = suggestion?.properties || {};
  const mainText =
    props.name || props.structured_formatting?.main_text || suggestion?.place_name || '';
  const secondaryText = props.formatted_address || props.structured_formatting?.secondary_text;

  return (
    <div className="flex min-w-0 items-center gap-3 py-1">
      <span className="flex-shrink-0 text-lg leading-none" aria-hidden="true">
        <IconHeart className="cm-favorite-heart h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium truncate">{mainText}</span>
        {secondaryText ? (
          <span className="text-xs text-gray-400 truncate">{secondaryText}</span>
        ) : null}
      </div>
    </div>
  );
}

function CurrentLocationAutocompleteOptionLabel({ suggestion }) {
  const mainText =
    suggestion?.properties?.structured_formatting?.main_text || suggestion?.place_name || '';
  const secondaryText = suggestion?.properties?.structured_formatting?.secondary_text;

  return (
    <div className="flex min-w-0 items-center gap-3 py-1">
      <span className="flex-shrink-0 text-lg leading-none opacity-70" aria-hidden="true">
        <IconGPS className="inline-block h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium truncate">{mainText}</span>
        {secondaryText ? (
          <span className="text-xs text-gray-400 truncate">{secondaryText}</span>
        ) : null}
      </div>
    </div>
  );
}

function buildSuggestionOption(suggestion) {
  let label;
  if (suggestion.isCurrentLocation) {
    label = <CurrentLocationAutocompleteOptionLabel suggestion={suggestion} />;
  } else if (suggestion.isFavorite) {
    label = <FavoriteAutocompleteOptionLabel suggestion={suggestion} />;
  } else {
    label = (
      <PlacesAutocompleteOptionLabel
        suggestion={suggestion}
        rowClassName="flex min-w-0 items-center gap-3 py-1"
      />
    );
  }

  return {
    value: suggestion.isFavorite
      ? suggestion.commitLabel || suggestion.place_name
      : suggestion.place_name,
    label,
    key: suggestion.id,
    suggestion,
  };
}

function buildAutocompleteOptions(suggestions) {
  const currentLocation = suggestions.filter((suggestion) => suggestion.isCurrentLocation);
  const favorites = suggestions.filter((suggestion) => suggestion.isFavorite);
  const places = suggestions.filter(
    (suggestion) => !suggestion.isFavorite && !suggestion.isCurrentLocation
  );

  const options = currentLocation.map(buildSuggestionOption);

  if (favorites.length > 0 && places.length === 0) {
    return [...options, ...favorites.map(buildSuggestionOption)];
  }

  if (favorites.length > 0) {
    options.push({
      label: 'Favoritos',
      options: favorites.map(buildSuggestionOption),
    });
  }
  if (places.length > 0) {
    options.push(...places.map(buildSuggestionOption));
  }

  return options;
}

export default function LocationSearchInput({ inputType, parentComponent, className = 'w-full' }) {
  const state = parentComponent.state;
  const handlers = parentComponent;

  const isFrom = inputType === 'from';
  const placeholder = isFrom ? 'Origem' : 'Destino';
  const isGeolocating = state.geolocatingInput === inputType;
  const searchValue = state[`${inputType}SearchValue`];
  const hasPoint = Boolean(parentComponent.props[`${inputType}Point`]);
  const showClear = Boolean(searchValue) || hasPoint;
  const suggestions = state[`${inputType}Suggestions`];
  const query = (searchValue || '').trim();
  const showLocalDropdown =
    state.focusedInput === inputType &&
    query.length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH &&
    suggestions.length > 0;
  const showSuffix = showClear || isGeolocating;

  const inputSuffix = showSuffix ? (
    <div className="cm-route-points__input-actions">
      {showClear && (
        <Button
          type="text"
          shape="circle"
          icon={<IconClear className="cm-route-points__input-action-icon" />}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handlers.handleClearInput(inputType)}
          className="cm-route-points__input-action cm-route-points__input-action--clear"
          title="Limpar"
          aria-label={`Limpar ${placeholder.toLowerCase()}`}
        />
      )}
      {isGeolocating && (
        <Spin
          size="small"
          className="cm-route-points__input-action cm-route-points__input-action--loading"
          indicator={<LoadingOutlined spin />}
          aria-label="Buscando localização atual"
        />
      )}
    </div>
  ) : null;

  return (
    <AutoComplete
      value={searchValue}
      onChange={(value) =>
        handlers.handleManualInputChange
          ? handlers.handleManualInputChange(inputType, value)
          : parentComponent.setState({ [`${inputType}SearchValue`]: value })
      }
      onSearch={(value) => handlers.handleSearch(value, inputType)}
      options={buildAutocompleteOptions(suggestions)}
      onSelect={(value, option) => handlers.handleSelect(option.suggestion, inputType)}
      open={showLocalDropdown ? true : undefined}
      className={className}
    >
      <Input
        placeholder={
          state.focusedInput === inputType
            ? ENABLE_MAP_CLICK_TO_SET_POINTS
              ? 'Digite ou clique no mapa'
              : 'Comece a digitar para buscar'
            : placeholder
        }
        prefix={
          <IconSearch
            className="text-white opacity-30"
            style={{
              display: 'inline-block',
            }}
          />
        }
        suffix={inputSuffix}
        onFocus={() => handlers.handleInputFocus(inputType)}
        onBlur={() => handlers.handleInputBlur(inputType)}
      />
    </AutoComplete>
  );
}
