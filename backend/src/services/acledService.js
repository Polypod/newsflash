const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class ACLEDService {
  constructor() {
    this.baseUrl = 'https://api.acleddata.com/acled/read';
    this.email = config.acledEmail;
    this.password = config.acledPassword;
  }

  async fetchConflicts(options = {}) {
    try {
      const { startDate, endDate, limit = 1000 } = options;
      
      const params = {
        email: this.email,
        password: this.password,
        limit: limit,
        format: 'json'
      };

      if (startDate) {
        params.event_date = startDate;
        params.event_date_where = '>=';
      }

      if (endDate) {
        params.event_date = endDate;
        params.event_date_where = '<=';
      }

      const response = await axios.get(this.baseUrl, { params });
      
      if (response.data.status === 200) {
        const conflicts = this.normalizeConflicts(response.data.data || []);
        logger.info(`Fetched ${conflicts.length} conflicts from ACLED`);
        return conflicts;
      } else {
        logger.error('ACLED API error:', response.data);
        return [];
      }
    } catch (error) {
      logger.error('Error fetching conflicts from ACLED:', error.message);
      return [];
    }
  }

  normalizeConflicts(rawConflicts) {
    return rawConflicts.map(conflict => ({
      source: 'acled',
      external_id: conflict.data_id || conflict.event_id,
      title: conflict.notes || `${conflict.event_type} in ${conflict.country}`,
      description: conflict.notes,
      event_type: this.mapEventType(conflict.event_type),
      severity: this.mapSeverity(conflict.fatalities),
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(conflict.longitude) || 0,
          parseFloat(conflict.latitude) || 0
        ]
      },
      region: conflict.region,
      country: conflict.country,
      event_date: conflict.event_date,
      actors: [conflict.actor1, conflict.actor2].filter(Boolean),
      fatalities: parseInt(conflict.fatalities) || 0,
      notes: conflict.notes
    }));
  }

  mapEventType(eventType) {
    const typeMap = {
      'Battles': 'conflict',
      'Violence against civilians': 'conflict',
      'Protests': 'protest',
      'Riots': 'riot',
      'Strategic developments': 'military',
      'Explosions/Remote violence': 'conflict'
    };
    return typeMap[eventType] || 'conflict';
  }

  mapSeverity(fatalities) {
    const count = parseInt(fatalities) || 0;
    if (count === 0) return 'low';
    if (count < 10) return 'medium';
    if (count < 100) return 'high';
    return 'critical';
  }
}

module.exports = new ACLEDService();
