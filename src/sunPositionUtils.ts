/**
 * Sun position calculation utilities for Mapbox 3D lighting
 * Based on solar position algorithms for accurate sun positioning
 */

export interface SunPosition {
  /** Horizontal angle (0–360°, 0 = north) */
  azimuthal: number;
  /** Vertical angle clamped 0–90° (0 = horizon, 90 = zenith) */
  polar: number;
  /** Uncapped solar altitude in degrees */
  altitude: number;
  isDaytime: boolean;
}

/**
 * Calculate the sun's position for a given location and time
 */
export function calculateSunPosition(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): SunPosition {
  const lat = (latitude * Math.PI) / 180;

  const dayOfYear = Math.floor(
    (+date - +new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );

  const declination =
    (23.45 * Math.sin((((360 * (284 + dayOfYear)) / 365) * Math.PI) / 180) * Math.PI) / 180;

  const time = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const hourAngle = ((time - 12) * 15 * Math.PI) / 180;

  const altitude = Math.asin(
    Math.sin(declination) * Math.sin(lat) +
      Math.cos(declination) * Math.cos(lat) * Math.cos(hourAngle)
  );

  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)
  );

  const azimuthDegrees = ((azimuth * 180) / Math.PI + 180) % 360;
  const altitudeDegrees = (altitude * 180) / Math.PI;

  return {
    azimuthal: azimuthDegrees,
    polar: Math.max(0, Math.min(90, altitudeDegrees)),
    altitude: altitudeDegrees,
    isDaytime: altitudeDegrees > 0,
  };
}

export function getCurrentSunPosition(latitude: number, longitude: number): SunPosition {
  return calculateSunPosition(latitude, longitude, new Date());
}

export function isCurrentlyDaytime(latitude: number, longitude: number): boolean {
  return getCurrentSunPosition(latitude, longitude).isDaytime;
}
