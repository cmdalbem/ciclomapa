import React from 'react';
import { AutoComplete, Button, Input } from 'antd';
import { MdGpsFixed as IconGPS } from 'react-icons/md';
import { HiSearch as IconSearch } from 'react-icons/hi';

import { ENABLE_MAP_CLICK_TO_SET_POINTS } from '../../../config/constants.js';
import PlacesAutocompleteOptionLabel from '../../../PlacesAutocompleteOptionLabel.jsx';

export default function LocationSearchInput({ inputType, parentComponent, className = 'w-full' }) {
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
      allowClear={true}
      onClear={() => handlers.handleClearInput(inputType)}
    >
      <Input
        // size="large"
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
