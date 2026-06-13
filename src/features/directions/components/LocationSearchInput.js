import React from 'react';
import { AutoComplete, Button, Input, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { MdGpsFixed as IconGPS } from 'react-icons/md';
import { HiSearch as IconSearch, HiX as IconClear } from 'react-icons/hi';

import { ENABLE_MAP_CLICK_TO_SET_POINTS } from '../../../config/constants.js';
import { PlacesAutocompleteOptionLabel } from '../../../GooglePlacesGeocoder.js';

export default function LocationSearchInput({ inputType, parentComponent, className = 'w-full' }) {
  const state = parentComponent.state;
  const handlers = parentComponent;

  const isFrom = inputType === 'from';
  const placeholder = isFrom ? 'Origem' : 'Destino';
  const showGeolocation = isFrom;
  const isGeolocating = isFrom && state.fromGeolocating;
  const searchValue = state[`${inputType}SearchValue`];
  const hasPoint = Boolean(parentComponent.props[`${inputType}Point`]);
  const showClear = Boolean(searchValue) || hasPoint;
  const showSuffix = showClear || showGeolocation;

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
      {showGeolocation &&
        (isGeolocating ? (
          <Spin
            size="small"
            className="cm-route-points__input-action cm-route-points__input-action--loading"
            indicator={<LoadingOutlined spin />}
            aria-label="Buscando localização atual"
          />
        ) : (
          <Button
            type="text"
            shape="circle"
            icon={<IconGPS className="cm-route-points__input-action-icon" />}
            onClick={() => handlers.handleGeolocation(inputType)}
            className="cm-route-points__input-action cm-route-points__input-action--gps"
            title="Usar localização atual"
            aria-label="Usar localização atual"
          />
        ))}
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
      options={state[`${inputType}Suggestions`].map((suggestion) => ({
        value: suggestion.place_name,
        label: (
          <PlacesAutocompleteOptionLabel
            suggestion={suggestion}
            rowClassName="flex min-w-0 items-center gap-3 py-1"
          />
        ),
        key: suggestion.id,
        suggestion,
      }))}
      onSelect={(value, option) => handlers.handleSelect(option.suggestion, inputType)}
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
