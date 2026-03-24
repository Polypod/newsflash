const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

// UCDP API base — all requests require x-ucdp-access-token header.
// Authenticated access was introduced Feb 2026 to protect service stability.
const BASE_URL = 'https://ucdpapi.pcr.uu.se/api';

// Current GED dataset version (academic year release — events through end of prior year).
// 25.1 = released 2025, covers events through 2024-12-31.
// Update when UCDP releases a new version.
const GED_VERSION     = '25.1';
const DYADIC_VERSION  = '25.1';
const NS_VERSION      = '25.1';   // nonstate
const OS_VERSION      = '25.1';   // onesided

// type_of_violence codes (GED codebook)
const VIOLENCE_TYPE = {
  1: 'state-based',   // government vs. armed group
  2: 'non-state',     // armed group vs. armed group
  3: 'one-sided',     // actor deliberately kills civilians
};

// region strings from UCDP — kept as-is but available for filtering
// "Africa", "Americas", "Asia", "Europe", "Middle East"

class UCDPService {
  constructor() {
    if (!config.ucdpAccessToken) {
      logger.warn('UCDP_ACCESS_TOKEN not configured — UCDP API calls will fail');
    }
  }

  // ── Internal HTTP ──────────────────────────────────────────────────────────

  async _get(endpoint, params = {}) {
    if (!config.ucdpAccessToken) {
      throw new Error('UCDP_ACCESS_TOKEN required');
    }

    try {
      const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { pagesize: 1000, ...params },
        headers: { 'x-ucdp-access-token': config.ucdpAccessToken },
        timeout: 30_000,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const body   = error.response?.data;
      logger.error('UCDP HTTP error', {
        status,
        endpoint,
        params,
        body: typeof body === 'object' ? JSON.stringify(body) : body,
      });
      throw error;
    }
  }

  // Paginate through all results (UCDP default pagesize max varies; use 1000)
  async _getAll(endpoint, params = {}, maxPages = 20) {
    const results = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < maxPages) {
      const data = await this._get(endpoint, { ...params, page });
      results.push(...(data.Result || []));
      totalPages = data.TotalPages || 1;
      page++;
    }

    return results;
  }

  // ── Georeferenced Event Dataset (GED) ─────────────────────────────────────
  // State-based, non-state, and one-sided violence events with precise lat/lon,
  // source citations, and best/high/low fatality estimates.
  // Covers 1989–2024 (v25.1). Use startDate/endDate to scope recent events.

  async fetchGEDEvents(options = {}) {
    const {
      startDate,
      endDate,
      countryId,
      typeOfViolence,
      pagesize = 1000,
    } = options;

    try {
      const params = { pagesize };
      if (startDate)       params.StartDate       = startDate;
      if (endDate)         params.EndDate         = endDate;
      if (countryId)       params.Country         = Array.isArray(countryId)
        ? countryId.join(',') : countryId;
      if (typeOfViolence)  params.TypeOfViolence  = typeOfViolence;

      const data = await this._get(`gedevents/${GED_VERSION}`, params);
      const events = (data.Result || []).map(e => this._normalizeGEDEvent(e));
      logger.info(`Fetched ${events.length} UCDP GED events (of ${data.TotalCount})`);
      return { events, totalCount: data.TotalCount };
    } catch (error) {
      logger.error('Error fetching UCDP GED events', { error: error.message });
      return { events: [], totalCount: 0 };
    }
  }

  // ── Dyadic armed conflicts ─────────────────────────────────────────────────
  // State-based conflicts: government(s) vs. armed group(s), per dyad per year.
  // Intensity: 1 = minor (25–999 deaths/yr), 2 = war (1000+ deaths/yr).
  // Type: 1=territory, 2=government, 3=both, 4=non-state.

  async fetchDyadicConflicts(options = {}) {
    const { year, region, pagesize = 1000 } = options;
    try {
      const params = { pagesize };
      if (year)   params.Year   = year;
      if (region) params.Region = region;

      const data = await this._get(`dyadic/${DYADIC_VERSION}`, params);
      logger.info(`Fetched ${(data.Result || []).length} UCDP dyadic conflicts`);
      return data.Result || [];
    } catch (error) {
      logger.error('Error fetching UCDP dyadic conflicts', { error: error.message });
      return [];
    }
  }

  // ── Non-state conflicts ────────────────────────────────────────────────────
  // Armed clashes between organised armed groups — neither side is the government.
  // Includes gang wars, militia clashes, communal violence.

  async fetchNonstateConflicts(options = {}) {
    const { year, region, pagesize = 1000 } = options;
    try {
      const params = { pagesize };
      if (year)   params.Year   = year;
      if (region) params.Region = region;

      const data = await this._get(`nonstate/${NS_VERSION}`, params);
      logger.info(`Fetched ${(data.Result || []).length} UCDP non-state conflicts`);
      return data.Result || [];
    } catch (error) {
      logger.error('Error fetching UCDP non-state conflicts', { error: error.message });
      return [];
    }
  }

  // ── One-sided violence ─────────────────────────────────────────────────────
  // Government or armed group deliberately targeting civilians.
  // is_government_actor=true → state perpetrator; false → armed group.

  async fetchOnesidedViolence(options = {}) {
    const { year, region, pagesize = 1000 } = options;
    try {
      const params = { pagesize };
      if (year)   params.Year   = year;
      if (region) params.Region = region;

      const data = await this._get(`onesided/${OS_VERSION}`, params);
      logger.info(`Fetched ${(data.Result || []).length} UCDP one-sided violence records`);
      return data.Result || [];
    } catch (error) {
      logger.error('Error fetching UCDP one-sided violence', { error: error.message });
      return [];
    }
  }

  // ── Normalization ──────────────────────────────────────────────────────────
  // Converts GED events to the same shape used for ACLED conflicts so they can
  // be stored in the conflicts table and displayed on the map layer together.

  _normalizeGEDEvent(event) {
    return {
      source:        'ucdp',
      external_id:   String(event.id),
      title:         event.conflict_name || `${VIOLENCE_TYPE[event.type_of_violence] || 'conflict'} in ${event.country}`,
      description:   [event.source_headline, event.where_description].filter(Boolean).join(' — ') || null,
      event_type:    this._mapViolenceType(event.type_of_violence),
      disorder_type: VIOLENCE_TYPE[event.type_of_violence] || null,
      sub_event_type: null,
      severity:      this._mapSeverity(event.best),
      location: {
        type:        'Point',
        coordinates: [
          parseFloat(event.longitude) || 0,
          parseFloat(event.latitude)  || 0,
        ],
      },
      region:         event.region,
      country:        event.country,
      admin1:         event.adm_1,
      event_date:     event.date_start,
      actors:         [event.side_a, event.side_b].filter(Boolean),
      fatalities:     parseInt(event.best) || 0,
      fatalities_low:  parseInt(event.low)  || 0,
      fatalities_high: parseInt(event.high) || 0,
      // UCDP-specific fields
      conflict_name:  event.conflict_name,
      dyad_name:      event.dyad_name,
      type_of_violence: event.type_of_violence,
      source_article: event.source_article,
      source_headline: event.source_headline,
      date_end:       event.date_end,
    };
  }

  _mapViolenceType(code) {
    const map = { 1: 'conflict', 2: 'conflict', 3: 'conflict' };
    return map[code] || 'conflict';
  }

  _mapSeverity(best) {
    const n = parseInt(best) || 0;
    if (n === 0)    return 'low';
    if (n < 10)     return 'medium';
    if (n < 100)    return 'high';
    return 'critical';
  }
}

module.exports = new UCDPService();
