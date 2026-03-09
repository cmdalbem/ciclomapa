import React from 'react';
import { AutoComplete, Button, Input } from 'antd';
import { MdGpsFixed as IconGPS } from 'react-icons/md';
import { HiSearch as IconSearch } from 'react-icons/hi';

import { ENABLE_MAP_CLICK_TO_SET_POINTS } from '../../../config/constants.js';

export default function LocationSearchInput({
  inputType,
  parentComponent,
  googlePlacesGeocoder,
  className = 'w-full',
}) {
  const state = parentComponent.state;
  const handlers = parentComponent;

  const isFrom = inputType === 'from';
  const placeholder = isFrom ? 'Origem' : 'Destino';
  const showGeolocation = isFrom; // Only show GPS button for origin

  return (
    <AutoComplete
      value={state[`${inputType}SearchValue`]}
      onChange={(value) => parentComponent.setState({ [`${inputType}SearchValue`]: value })}
      onSearch={(value) => handlers.handleSearch(value, inputType)}
      loading={state[`${inputType}SearchLoading`]}
      options={state[`${inputType}Suggestions`].map((suggestion) => {
        const mainText =
          suggestion.properties?.structured_formatting?.main_text || suggestion.place_name;
        const secondaryText = suggestion.properties?.structured_formatting?.secondary_text;

        return {
          value: suggestion.place_name,
          label: (
            <div className="flex items-center gap-3 py-1">
              <span className="text-lg flex-shrink-0 opacity-70">
                {googlePlacesGeocoder.getPlaceTypeIcon(suggestion.properties.types)}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{mainText}</span>
                {secondaryText && (
                  <span className="text-xs text-gray-400 truncate">{secondaryText}</span>
                )}
              </div>
            </div>
          ),
          key: suggestion.id,
          suggestion: suggestion,
        };
      })}
      onSelect={(value, option) => handlers.handleSelect(option.suggestion, inputType)}
      className={className}
      size="large"
      allowClear={true}
      onClear={() => handlers.handleClearInput(inputType)}
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
        suffix={
          showGeolocation && (
            <Button
              type="text"
              shape="circle"
              icon={
                <IconGPS
                  className="text-white"
                  style={{
                    display: 'inline-block',
                  }}
                />
              }
              onClick={() => handlers.handleGeolocation(inputType)}
              className="text-white border-0"
              title="Usar localização atual"
              aria-label="Usar localização atual"
              size="small"
            />
          )
        }
        onFocus={() => handlers.handleInputFocus(inputType)}
        onBlur={() => handlers.handleInputBlur(inputType)}
      />
    </AutoComplete>
  );
}
