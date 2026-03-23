/**
 * Time utility functions
 */

/**
 * Format date to relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

/**
 * Format date to ISO string
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO date string
 */
export function formatISODate(date) {
  return new Date(date).toISOString();
}

/**
 * Format date to locale string
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale (default: 'en-US')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatLocaleDate(date, locale = 'en-US', options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
}

/**
 * Format date to time string
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale (default: 'en-US')
 * @returns {string} Formatted time string
 */
export function formatTime(date, locale = 'en-US') {
  return new Date(date).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date to date string
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatDate(date, locale = 'en-US') {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get start of day
 * @param {Date|string|number} date - Date
 * @returns {Date} Start of day
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 * @param {Date|string|number} date - Date
 * @returns {Date} End of day
 */
export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of week
 * @param {Date|string|number} date - Date
 * @param {number} weekStartsOn - Week starts on (0: Sunday, 1: Monday)
 * @returns {Date} Start of week
 */
export function startOfWeek(date, weekStartsOn = 1) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of week
 * @param {Date|string|number} date - Date
 * @param {number} weekStartsOn - Week starts on (0: Sunday, 1: Monday)
 * @returns {Date} End of week
 */
export function endOfWeek(date, weekStartsOn = 1) {
  const d = startOfWeek(date, weekStartsOn);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of month
 * @param {Date|string|number} date - Date
 * @returns {Date} Start of month
 */
export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of month
 * @param {Date|string|number} date - Date
 * @returns {Date} End of month
 */
export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add days to date
 * @param {Date|string|number} date - Date
 * @param {number} days - Number of days to add
 * @returns {Date} New date
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add hours to date
 * @param {Date|string|number} date - Date
 * @param {number} hours - Number of hours to add
 * @returns {Date} New date
 */
export function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Add minutes to date
 * @param {Date|string|number} date - Date
 * @param {number} minutes - Number of minutes to add
 * @returns {Date} New date
 */
export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Check if date is today
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
  const today = new Date();
  const d = new Date(date);
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is yesterday
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is yesterday
 */
export function isYesterday(date) {
  const yesterday = addDays(new Date(), -1);
  const d = new Date(date);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Check if date is in the past
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
  return new Date(date) < new Date();
}

/**
 * Check if date is in the future
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFuture(date) {
  return new Date(date) > new Date();
}

/**
 * Get time range label
 * @param {string} range - Range identifier
 * @returns {string} Human-readable range label
 */
export function getTimeRangeLabel(range) {
  const labels = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '1y': 'Last Year',
    custom: 'Custom Range',
  };
  return labels[range] || range;
}

/**
 * Get time range dates
 * @param {string} range - Range identifier
 * @returns {Object} Start and end dates { start, end }
 */
export function getTimeRangeDates(range) {
  const now = new Date();
  let start;

  switch (range) {
    case '1h':
      start = addHours(now, -1);
      break;
    case '6h':
      start = addHours(now, -6);
      break;
    case '24h':
      start = addHours(now, -24);
      break;
    case '7d':
      start = addDays(now, -7);
      break;
    case '30d':
      start = addDays(now, -30);
      break;
    case '90d':
      start = addDays(now, -90);
      break;
    case '1y':
      start = addDays(now, -365);
      break;
    default:
      start = addDays(now, -7);
  }

  return { start, end: now };
}
