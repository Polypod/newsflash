/**
 * Geospatial utility functions
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
 * Convert radians to degrees
 * @param {number} radians
 * @returns {number} Degrees
 */
function toDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Calculate midpoint between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {Object} Midpoint { lat, lon }
 */
export function calculateMidpoint(lat1, lon1, lat2, lon2) {
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const dLon = toRad(lon2 - lon1);

  const bx = Math.cos(lat2Rad) * Math.cos(dLon);
  const by = Math.cos(lat2Rad) * Math.sin(dLon);

  const lat3 = toDeg(
    Math.atan2(
      Math.sin(lat1Rad) + Math.sin(lat2Rad),
      Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
    )
  );
  const lon3 = toDeg(toRad(lon1) + Math.atan2(by, Math.cos(lat1Rad) + bx));

  return { lat: lat3, lon: lon3 };
}

/**
 * Check if a point is within a bounding box
 * @param {number} lat - Latitude of point
 * @param {number} lon - Longitude of point
 * @param {Object} bbox - Bounding box { minLat, maxLat, minLon, maxLon }
 * @returns {boolean} True if point is within bounding box
 */
export function isWithinBounds(lat, lon, bbox) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

/**
 * Get bounding box from center point and radius
 * @param {number} lat - Latitude of center point
 * @param {number} lon - Longitude of center point
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Bounding box { minLat, maxLat, minLon, maxLon }
 */
export function getBoundingBoxFromCenter(lat, lon, radiusKm) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (radiusKm / R) * (180 / Math.PI);
  const dLon = (radiusKm / (R * Math.cos(toRad(lat)))) * (180 / Math.PI);

  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} precision - Number of decimal places
 * @returns {string} Formatted coordinates string
 */
export function formatCoordinates(lat, lon, precision = 4) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
}

/**
 * Parse coordinates from string
 * @param {string} coordString - Coordinates string (e.g., "51.5074°N, 0.1278°W")
 * @returns {Object} Parsed coordinates { lat, lon }
 */
export function parseCoordinates(coordString) {
  const regex = /([0-9.]+)°([NS]),\s*([0-9.]+)°([EW])/;
  const match = coordString.match(regex);

  if (!match) {
    throw new Error('Invalid coordinate format');
  }

  let lat = parseFloat(match[1]);
  let lon = parseFloat(match[3]);

  if (match[2] === 'S') lat = -lat;
  if (match[4] === 'W') lon = -lon;

  return { lat, lon };
}

/**
 * Calculate area of a polygon using Shoelace formula
 * @param {Array} coordinates - Array of [lon, lat] coordinates
 * @returns {number} Area in square kilometers
 */
export function calculatePolygonArea(coordinates) {
  if (coordinates.length < 3) return 0;

  let area = 0;
  const R = 6371; // Earth's radius in kilometers

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[j];

    area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }

  area = Math.abs((area * R * R) / 2);
  return area;
}

/**
 * Simplify a polyline using Douglas-Peucker algorithm
 * @param {Array} coordinates - Array of [lon, lat] coordinates
 * @param {number} tolerance - Tolerance in degrees
 * @returns {Array} Simplified coordinates
 */
export function simplifyPolyline(coordinates, tolerance = 0.0001) {
  if (coordinates.length <= 2) return coordinates;

  let maxDistance = 0;
  let maxIndex = 0;
  const end = coordinates.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(
      coordinates[i],
      coordinates[0],
      coordinates[end]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPolyline(coordinates.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolyline(coordinates.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [coordinates[0], coordinates[end]];
}

/**
 * Calculate perpendicular distance from a point to a line
 * @param {Array} point - [lon, lat] coordinates
 * @param {Array} lineStart - [lon, lat] coordinates
 * @param {Array} lineEnd - [lon, lat] coordinates
 * @returns {number} Distance in degrees
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
