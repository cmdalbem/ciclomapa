/**
 * Sun position calculation utilities for Mapbox 3D lighting
 * Based on solar position algorithms for accurate sun positioning
 */

/**
 * Calculate the sun's position for a given location and time
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @param {Date} date - Date and time for calculation
 * @returns {Object} Sun position with azimuthal and polar angles
 */
export function calculateSunPosition(latitude, longitude, date = new Date()) {
  // Convert to radians
  const lat = (latitude * Math.PI) / 180;
  const lng = (longitude * Math.PI) / 180;

  // Julian day calculation
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const year = date.getFullYear();

  // Solar declination (angle between rays of the Sun and the plane of the Earth's equator)
  const declination =
    (23.45 * Math.sin((((360 * (284 + dayOfYear)) / 365) * Math.PI) / 180) * Math.PI) / 180;

  // Hour angle (angle between the meridian of the observer and the meridian of the sun)
  const time = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const hourAngle = ((time - 12) * 15 * Math.PI) / 180;

  // Solar altitude (elevation angle)
  const altitude = Math.asin(
    Math.sin(declination) * Math.sin(lat) +
      Math.cos(declination) * Math.cos(lat) * Math.cos(hourAngle)
  );

  // Solar azimuth (compass direction from which the sun is shining)
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)
  );

  // Convert to degrees and adjust for Mapbox coordinate system
  const azimuthDegrees = ((azimuth * 180) / Math.PI + 180) % 360;
  const altitudeDegrees = (altitude * 180) / Math.PI;

  // Mapbox 3D lighting uses:
  // - azimuthal: horizontal angle (0-360 degrees, 0 = north, 90 = east, 180 = south, 270 = west)
  // - polar: vertical angle (0-90 degrees, 0 = horizon, 90 = zenith)

  return {
    azimuthal: azimuthDegrees,
    polar: Math.max(0, Math.min(90, altitudeDegrees)), // Clamp between 0-90 degrees
    altitude: altitudeDegrees,
    isDaytime: altitudeDegrees > 0,
  };
}

/**
 * Get current sun position for user's location
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {Object} Current sun position
 */
export function getCurrentSunPosition(latitude, longitude) {
  return calculateSunPosition(latitude, longitude, new Date());
}

/**
 * Check if it's currently daytime based on sun altitude
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {boolean} True if it's daytime
 */
export function isCurrentlyDaytime(latitude, longitude) {
  const sunPos = getCurrentSunPosition(latitude, longitude);
  return sunPos.isDaytime;
}
