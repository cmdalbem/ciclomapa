/**
 * Human-readable notes for icon review. Wording for Geocoder types follows the
 * Maps JavaScript API “Address types and address component types” section:
 * https://developers.google.com/maps/documentation/javascript/geocoding#address-types
 *
 * Place categories not in that table are labeled as Places types (see Place types doc).
 */

/** @typedef {'geocoder_result' | 'geocoder_component' | 'places'} PlaceTypeDocSource */

/**
 * @type {Record<string, { source: PlaceTypeDocSource; text: string }>}
 */
export const PLACE_TYPE_ICON_DESCRIPTIONS = {
  // —— Geocoder `results[].types[]` (plus shared tags) ——
  street_address: {
    source: 'geocoder_result',
    text: 'A precise street address.',
  },
  route: {
    source: 'geocoder_result',
    text: 'A named route (such as a highway or numbered road).',
  },
  intersection: {
    source: 'geocoder_result',
    text: 'A major intersection, usually of two major roads.',
  },
  political: {
    source: 'geocoder_result',
    text: 'A political entity; usually indicates a polygon of some civil administration. Often appears together with locality, country, etc.',
  },
  country: {
    source: 'geocoder_result',
    text: 'The national political entity; typically the highest-order type returned by the Geocoder.',
  },
  administrative_area_level_1: {
    source: 'geocoder_result',
    text: 'First-order civil entity below the country (e.g. a U.S. state). Not all countries use this level.',
  },
  administrative_area_level_2: {
    source: 'geocoder_result',
    text: 'Second-order civil entity below the country (e.g. a U.S. county). Not all countries use this level.',
  },
  administrative_area_level_3: {
    source: 'geocoder_result',
    text: 'Third-order civil entity below the country; indicates a minor civil division where used.',
  },
  administrative_area_level_4: {
    source: 'geocoder_result',
    text: 'Fourth-order civil entity below the country; minor civil division where used.',
  },
  administrative_area_level_5: {
    source: 'geocoder_result',
    text: 'Fifth-order civil entity below the country; minor civil division where used.',
  },
  locality: {
    source: 'geocoder_result',
    text: 'An incorporated city or town political entity.',
  },
  sublocality: {
    source: 'geocoder_result',
    text: 'A first-order civil entity below a locality. Results may use sublocality_level_1 … sublocality_level_5 for finer levels.',
  },
  neighborhood: {
    source: 'geocoder_result',
    text: 'A named neighborhood.',
  },
  premise: {
    source: 'geocoder_result',
    text: 'A named location, usually a building or collection of buildings with a common name.',
  },
  subpremise: {
    source: 'geocoder_result',
    text: 'An addressable entity below the premise level, such as an apartment, unit, or suite.',
  },
  postal_code: {
    source: 'geocoder_result',
    text: 'A postal code used to address postal mail within the country.',
  },
  natural_feature: {
    source: 'geocoder_result',
    text: 'A prominent natural feature.',
  },
  airport: {
    source: 'geocoder_result',
    text: 'An airport.',
  },
  park: {
    source: 'geocoder_result',
    text: 'A named park.',
  },
  point_of_interest: {
    source: 'geocoder_result',
    text: 'A named point of interest: a prominent local entity that does not easily fit another category (e.g. a well-known tower or landmark).',
  },

  // —— Geocoder address *component* types (same doc; “In addition to the above…”) ——
  establishment: {
    source: 'geocoder_component',
    text: 'Typically a place that has not yet been categorized. Also common on Places predictions alongside finer types.',
  },
  parking: {
    source: 'geocoder_component',
    text: 'A parking lot or parking structure.',
  },
  bus_station: {
    source: 'geocoder_component',
    text: 'The location of a bus stop or bus station.',
  },
  train_station: {
    source: 'geocoder_component',
    text: 'The location of a train station.',
  },
  transit_station: {
    source: 'geocoder_component',
    text: 'The location of a public transit stop (bus/train/transit interchange as returned by the Geocoder component-type list).',
  },

  // —— Common Places Autocomplete / Places types (not the main Geocoder address-type table) ——
  meal_delivery: {
    source: 'places',
    text: 'Food prepared for delivery.',
  },
  meal_takeaway: {
    source: 'places',
    text: 'Food for takeaway / pickup.',
  },
  restaurant: {
    source: 'places',
    text: 'Restaurant.',
  },
  food: {
    source: 'places',
    text: 'Food-related business (broader than restaurant).',
  },
  cafe: {
    source: 'places',
    text: 'Café.',
  },
  bar: {
    source: 'places',
    text: 'Bar or pub.',
  },
  night_club: {
    source: 'places',
    text: 'Nightclub.',
  },
  lodging: {
    source: 'places',
    text: 'Lodging (hotels, guesthouses, etc.).',
  },
  hotel: {
    source: 'places',
    text: 'Hotel.',
  },
  shopping_mall: {
    source: 'places',
    text: 'Shopping mall.',
  },
  store: {
    source: 'places',
    text: 'Retail store (generic).',
  },
  supermarket: {
    source: 'places',
    text: 'Supermarket or grocery.',
  },
  gas_station: {
    source: 'places',
    text: 'Fuel station.',
  },
  bank: {
    source: 'places',
    text: 'Bank.',
  },
  atm: {
    source: 'places',
    text: 'Automated teller / cash machine.',
  },
  car_wash: {
    source: 'places',
    text: 'Car wash.',
  },
  car_repair: {
    source: 'places',
    text: 'Auto repair.',
  },
  car_dealer: {
    source: 'places',
    text: 'Car dealership.',
  },
  bicycle_store: {
    source: 'places',
    text: 'Bicycle shop.',
  },
  hospital: {
    source: 'places',
    text: 'Hospital.',
  },
  pharmacy: {
    source: 'places',
    text: 'Pharmacy / drugstore.',
  },
  school: {
    source: 'places',
    text: 'School.',
  },
  university: {
    source: 'places',
    text: 'University.',
  },
  library: {
    source: 'places',
    text: 'Library.',
  },
  museum: {
    source: 'places',
    text: 'Museum.',
  },
  church: {
    source: 'places',
    text: 'Church.',
  },
  mosque: {
    source: 'places',
    text: 'Mosque.',
  },
  synagogue: {
    source: 'places',
    text: 'Synagogue.',
  },
  hindu_temple: {
    source: 'places',
    text: 'Hindu temple.',
  },
  amusement_park: {
    source: 'places',
    text: 'Amusement park.',
  },
  zoo: {
    source: 'places',
    text: 'Zoo.',
  },
  campground: {
    source: 'places',
    text: 'Campground.',
  },
  rv_park: {
    source: 'places',
    text: 'RV park.',
  },
  tourist_attraction: {
    source: 'places',
    text: 'Tourist attraction.',
  },
  casino: {
    source: 'places',
    text: 'Casino.',
  },
  bowling_alley: {
    source: 'places',
    text: 'Bowling alley.',
  },
  movie_theater: {
    source: 'places',
    text: 'Cinema / movie theater.',
  },
  movie_rental: {
    source: 'places',
    text: 'Video / movie rental.',
  },
  gym: {
    source: 'places',
    text: 'Gym / fitness.',
  },
  spa: {
    source: 'places',
    text: 'Day spa / spa.',
  },
  beauty_salon: {
    source: 'places',
    text: 'Beauty salon.',
  },
  hair_care: {
    source: 'places',
    text: 'Hair salon / barber.',
  },
  book_store: {
    source: 'places',
    text: 'Bookstore.',
  },
  electronics_store: {
    source: 'places',
    text: 'Electronics retailer.',
  },
  furniture_store: {
    source: 'places',
    text: 'Furniture store.',
  },
  jewelry_store: {
    source: 'places',
    text: 'Jewelry store.',
  },
  clothing_store: {
    source: 'places',
    text: 'Clothing store.',
  },
  shoe_store: {
    source: 'places',
    text: 'Shoe store.',
  },
  subway_station: {
    source: 'places',
    text: 'Subway / metro station (Places taxonomy).',
  },
};

export function getPlaceTypeDescription(type) {
  const entry = PLACE_TYPE_ICON_DESCRIPTIONS[type];
  if (!entry) {
    return 'No description added yet; check Google Maps Platform docs for this type string.';
  }
  return entry.text;
}
