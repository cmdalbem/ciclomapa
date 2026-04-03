import React from 'react';
import { googlePlacesGeocoder } from './googlePlacesClient.js';

/**
 * Single suggestion row for Ant Design AutoComplete (DirectionsPanel + city switcher).
 * Defaults match DirectionsPanel / LocationSearchInput.
 */
export default function PlacesAutocompleteOptionLabel({
  suggestion,
  rowClassName = 'flex min-w-0 items-center gap-3 py-1',
  iconWrapperClassName = 'flex-shrink-0 text-lg opacity-70',
  primaryClassName = 'text-sm font-medium truncate',
  secondaryClassName = 'text-xs text-gray-400 truncate',
}) {
  const mainText =
    suggestion?.properties?.structured_formatting?.main_text || suggestion?.place_name || '';
  const secondaryText = suggestion?.properties?.structured_formatting?.secondary_text;

  return (
    <div className={rowClassName}>
      <span className={iconWrapperClassName}>
        {googlePlacesGeocoder.getPlaceTypeIcon(suggestion?.properties?.types)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={primaryClassName}>{mainText}</span>
        {secondaryText ? <span className={secondaryClassName}>{secondaryText}</span> : null}
      </div>
    </div>
  );
}
