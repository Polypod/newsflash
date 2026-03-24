const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

const TOKEN_URL = 'https://acleddata.com/oauth/token';
const READ_URL  = 'https://acleddata.com/api/acled/read';
const CAST_URL  = 'https://acleddata.com/api/cast/read';

// ACLED region numeric codes (codebook Table 2)
const REGION_CODES = {
  'western-africa':         1,
  'middle-africa':          2,
  'eastern-africa':         3,
  'southern-africa':        4,
  'northern-africa':        5,
  'south-asia':             7,
  'southeast-asia':         9,
  'middle-east':            11,
  'europe':                 12,
  'caucasus-central-asia':  13,
  'central-america':        14,
  'south-america':          15,
  'caribbean':              16,
  'east-asia':              17,
  'north-america':          18,
  'oceania':                19,
};

// TOKEN_LIFETIME: ACLED issues 24-hour tokens; refresh 5 minutes before expiry
const TOKEN_LIFETIME_MS = (24 * 60 - 5) * 60 * 1000;

class ACLEDService {
  constructor() {
    this._token        = null;
    this._tokenExpiry  = 0;
    this._refreshToken = null;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) {
      return this._token;
    }

    // Prefer refresh_token (14-day validity) over full re-auth
    if (this._refreshToken) {
      try {
        await this._doTokenRequest({
          grant_type:    'refresh_token',
          refresh_token: this._refreshToken,
          client_id:     'acled',
        });
        return this._token;
      } catch (err) {
        logger.warn('ACLED refresh_token failed, falling back to password grant', { error: err.message });
        this._refreshToken = null;
      }
    }

    if (!config.acledEmail || !config.acledPassword) {
      throw new Error('ACLED_EMAIL and ACLED_PASSWORD required for authentication');
    }

    await this._doTokenRequest({
      username:   config.acledEmail,
      password:   config.acledPassword,
      grant_type: 'password',
      client_id:  'acled',
    });
    return this._token;
  }

  async _doTokenRequest(body) {
    const response = await axios.post(TOKEN_URL, new URLSearchParams(body).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    this._token        = response.data.access_token;
    this._refreshToken = response.data.refresh_token || this._refreshToken;
    this._tokenExpiry  = Date.now() + TOKEN_LIFETIME_MS;
    logger.info('ACLED token obtained', { grant: body.grant_type });
  }

  async _get(url, params) {
    const token = await this._getToken();
    try {
      const response = await axios.get(url, {
        params:  { ...params, _format: 'json' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const body   = error.response?.data;
      logger.error('ACLED HTTP error', {
        status,
        url,
        params,
        body: typeof body === 'object' ? JSON.stringify(body) : body,
      });
      throw error;
    }
  }

  // ── Region helper ─────────────────────────────────────────────────────────

  _regionCode(region) {
    if (!region) return undefined;
    if (typeof region === 'number') return region;
    return REGION_CODES[region.toLowerCase()] ?? region;
  }

  // ── Conflict events ───────────────────────────────────────────────────────

  async fetchConflicts(options = {}) {
    const { startDate, endDate, region, countries, eventTypes, limit = 1000 } = options;

    try {
      const params = { limit };

      if (startDate && endDate) {
        params.event_date       = `${startDate}|${endDate}`;
        params.event_date_where = 'BETWEEN';
      } else if (startDate) {
        params.event_date       = startDate;
        params.event_date_where = '>=';
      } else if (endDate) {
        params.event_date       = endDate;
        params.event_date_where = '<=';
      }

      const regionCode = this._regionCode(region);
      if (regionCode !== undefined) params.region = regionCode;
      if (countries?.length)        params.country    = countries.join('|');
      if (eventTypes?.length)       params.event_type = eventTypes.join('|');

      const data = await this._get(READ_URL, params);

      if (data.status === 200) {
        const conflicts = this._normalizeConflicts(data.data || []);
        logger.info(`Fetched ${conflicts.length} conflicts from ACLED`);
        return conflicts;
      }

      logger.error('ACLED API error', { status: data.status, error: data.error });
      return [];
    } catch (error) {
      logger.error('Error fetching conflicts from ACLED', { error: error.message });
      return [];
    }
  }

  // ── Aggregated data ───────────────────────────────────────────────────────
  // Returns weekly aggregated counts per country/admin1 (disorder_type, event_type,
  // sub_event_type, events, fatalities, population_best).

  async fetchAggregated(options = {}) {
    const { region, countries, startDate, endDate, limit = 5000 } = options;

    try {
      const params = { limit, export_type: 'aggregated' };

      if (startDate && endDate) {
        params.event_date       = `${startDate}|${endDate}`;
        params.event_date_where = 'BETWEEN';
      } else if (startDate) {
        params.event_date       = startDate;
        params.event_date_where = '>=';
      }

      const regionCode = this._regionCode(region);
      if (regionCode !== undefined) params.region = regionCode;
      if (countries?.length)        params.country = countries.join('|');

      const data = await this._get(READ_URL, params);

      if (data.status === 200) {
        logger.info(`Fetched ${(data.data || []).length} aggregated records from ACLED`);
        return data.data || [];
      }

      logger.error('ACLED aggregated API error', { status: data.status });
      return [];
    } catch (error) {
      logger.error('Error fetching aggregated data from ACLED', { error: error.message });
      return [];
    }
  }

  // ── CAST forecasts ────────────────────────────────────────────────────────
  // Returns rolling 4-week conflict forecasts (6 periods ahead) per country/admin1.
  // Fields: country, admin1, month, year, total_forecast, battles_forecast,
  //         erv_forecast (explosions/remote violence), vac_forecast (violence
  //         against civilians), plus observed counts for past periods.

  async fetchCAST(options = {}) {
    const { region, countries, year, month } = options;

    try {
      const params = {};

      const regionCode = this._regionCode(region);
      if (regionCode !== undefined) params.region = regionCode;
      if (countries?.length) params.country = countries.join('|');
      if (year)              params.year    = year;
      if (month)             params.month   = month;

      const data = await this._get(CAST_URL, params);

      if (data.status === 200) {
        logger.info(`Fetched ${(data.data || []).length} CAST forecasts from ACLED`);
        return data.data || [];
      }

      logger.error('ACLED CAST API error', { status: data.status });
      return [];
    } catch (error) {
      logger.error('Error fetching CAST from ACLED', { error: error.message });
      return [];
    }
  }

  // ── Normalization ─────────────────────────────────────────────────────────

  _normalizeConflicts(rawConflicts) {
    return rawConflicts.map(conflict => ({
      source:        'acled',
      external_id:   conflict.data_id || conflict.event_id_cnty || conflict.event_id,
      title:         conflict.notes || `${conflict.event_type} in ${conflict.country}`,
      description:   conflict.notes,
      event_type:    this._mapEventType(conflict.event_type),
      disorder_type: conflict.disorder_type,
      sub_event_type: conflict.sub_event_type,
      severity:      this._mapSeverity(conflict.fatalities),
      location: {
        type:        'Point',
        coordinates: [
          parseFloat(conflict.longitude) || 0,
          parseFloat(conflict.latitude)  || 0,
        ],
      },
      region:     conflict.region,
      country:    conflict.country,
      admin1:     conflict.admin1,
      event_date: conflict.event_date,
      actors:     [conflict.actor1, conflict.actor2].filter(Boolean),
      fatalities: parseInt(conflict.fatalities) || 0,
      notes:      conflict.notes,
    }));
  }

  _mapEventType(eventType) {
    const map = {
      'Battles':                     'conflict',
      'Violence against civilians':  'conflict',
      'Protests':                    'protest',
      'Riots':                       'riot',
      'Strategic developments':      'military',
      'Explosions/Remote violence':  'conflict',
    };
    return map[eventType] || 'conflict';
  }

  _mapSeverity(fatalities) {
    const n = parseInt(fatalities) || 0;
    if (n === 0)   return 'low';
    if (n < 10)    return 'medium';
    if (n < 100)   return 'high';
    return 'critical';
  }
}

module.exports = new ACLEDService();
