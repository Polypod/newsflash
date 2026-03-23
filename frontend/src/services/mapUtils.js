// Mapbox GL JS utility functions

/**
 * Convert GeoJSON coordinates to Mapbox LngLat
 * @param {Array} coordinates - [longitude, latitude]
 * @returns {Object} Mapbox LngLat object
 */
export function toLngLat(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }
  return {
    lng: coordinates[0],
    lat: coordinates[1],
  };
}

/**
 * Calculate distance between two points in kilometers
 * @param {Array} point1 - [longitude, latitude]
 * @param {Array} point2 - [longitude, latitude]
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(point1, point2) {
  if (!point1 || !point2) return 0;

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2[1] - point1[1]);
  const dLon = toRad(point2[0] - point1[0]);
  const lat1 = toRad(point1[1]);
  const lat2 = toRad(point2[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get bounding box from coordinates
 * @param {Array} coordinates - Array of [longitude, latitude] arrays
 * @returns {Object} Bounding box { sw: [lng, lat], ne: [lng, lat] }
 */
export function getBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  coordinates.forEach((coord) => {
    if (coord && coord.length >= 2) {
      minLng = Math.min(minLng, coord[0]);
      maxLng = Math.max(maxLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLat = Math.max(maxLat, coord[1]);
    }
  });

  return {
    sw: [minLng, minLat],
    ne: [maxLng, maxLat],
  };
}

/**
 * Fit map to bounds
 * @param {Object} map - Mapbox map instance
 * @param {Object} bounds - Bounding box { sw: [lng, lat], ne: [lng, lat] }
 * @param {Object} options - Fit bounds options
 */
export function fitToBounds(map, bounds, options = {}) {
  if (!map || !bounds) return;

  map.fitBounds([bounds.sw, bounds.ne], {
    padding: 50,
    maxZoom: 15,
    ...options,
  });
}

/**
 * Create GeoJSON feature from point
 * @param {Array} coordinates - [longitude, latitude]
 * @param {Object} properties - Feature properties
 * @returns {Object} GeoJSON feature
 */
export function createPointFeature(coordinates, properties = {}) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coordinates,
    },
    properties: properties,
  };
}

/**
 * Create GeoJSON feature collection from features
 * @param {Array} features - Array of GeoJSON features
 * @returns {Object} GeoJSON feature collection
 */
export function createFeatureCollection(features = []) {
  return {
    type: 'FeatureCollection',
    features: features,
  };
}

/**
 * Get severity color
 * @param {string} severity - Severity level (low, medium, high, critical)
 * @returns {string} Color hex code
 */
export function getSeverityColor(severity) {
  const colors = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  };
  return colors[severity] || '#6B7280';
}

/**
 * Get facility type color
 * @param {string} facilityType - Facility type
 * @returns {string} Color hex code
 */
export function getFacilityTypeColor(facilityType) {
  const colors = {
    oil_refinery: '#F59E0B',
    power_plant: '#3B82F6',
    natural_gas: '#10B981',
    nuclear: '#EF4444',
    renewable: '#8B5CF6',
  };
  return colors[facilityType] || '#6B7280';
}

/**
 * Format coordinates for display
 * @param {Array} coordinates - [longitude, latitude]
 * @returns {string} Formatted coordinates string
 */
export function formatCoordinates(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return 'Unknown';
  }
  const [lng, lat] = coordinates;
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

/**
 * Check if point is within bounds
 * @param {Array} point - [longitude, latitude]
 * @param {Object} bounds - Bounding box { sw: [lng, lat], ne: [lng, lat] }
 * @returns {boolean} True if point is within bounds
 */
export function isWithinBounds(point, bounds) {
  if (!point || !bounds) return false;

  const [lng, lat] = point;
  const [swLng, swLat] = bounds.sw;
  const [neLng, neLat] = bounds.ne;

  return lng >= swLng && lng <= neLng && lat >= swLat && lat <= neLat;
}
