const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class AviationService {
  constructor() {
    this.baseUrl = 'http://api.aviationstack.com/v1';
    this.apiKey = config.aviationstackApiKey;
  }

  async fetchActiveFlights(options = {}) {
    try {
      const { limit = 100, offset = 0 } = options;
      
      const response = await axios.get(`${this.baseUrl}/flights`, {
        params: {
          access_key: this.apiKey,
          limit,
          offset,
          flight_status: 'active'
        }
      });

      if (response.data && response.data.data) {
        const flights = response.data.data.map(flight => this.normalizeFlight(flight));
        logger.info(`Fetched ${flights.length} active flights from AviationStack`);
        return flights;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching flights from AviationStack:', error.message);
      return [];
    }
  }

  async fetchFlightsByRoute(departureIata, arrivalIata, options = {}) {
    try {
      const { limit = 100 } = options;
      
      const response = await axios.get(`${this.baseUrl}/flights`, {
        params: {
          access_key: this.apiKey,
          dep_iata: departureIata,
          arr_iata: arrivalIata,
          limit
        }
      });

      if (response.data && response.data.data) {
        const flights = response.data.data.map(flight => this.normalizeFlight(flight));
        logger.info(`Fetched ${flights.length} flights for route ${departureIata}-${arrivalIata}`);
        return flights;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching flights by route from AviationStack:', error.message);
      return [];
    }
  }

  normalizeFlight(rawFlight) {
    const lat = parseFloat(rawFlight.latitude) || 0;
    const lng = parseFloat(rawFlight.longitude) || 0;
    
    return {
      source: 'aviationstack',
      external_id: rawFlight.flight?.iata || rawFlight.flight?.icao || `flight_${Date.now()}`,
      flight_number: rawFlight.flight?.iata || rawFlight.flight?.icao || 'Unknown',
      airline: rawFlight.airline?.name || 'Unknown',
      aircraft_type: rawFlight.aircraft?.iata || rawFlight.aircraft?.icao || 'Unknown',
      departure_airport: rawFlight.departure?.airport || 'Unknown',
      departure_iata: rawFlight.departure?.iata || 'Unknown',
      arrival_airport: rawFlight.arrival?.airport || 'Unknown',
      arrival_iata: rawFlight.arrival?.iata || 'Unknown',
      flight_status: rawFlight.flight_status || 'unknown',
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      altitude: parseFloat(rawFlight.altitude) || 0,
      speed: parseFloat(rawFlight.speed) || 0,
      heading: parseFloat(rawFlight.direction) || 0,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AviationService();
