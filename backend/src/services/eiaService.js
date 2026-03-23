const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class EIAService {
  constructor() {
    this.baseUrl = 'https://api.eia.gov/v2';
    this.apiKey = config.eiaApiKey;
  }

  async fetchOilPrices() {
    try {
      const response = await axios.get(`${this.baseUrl}/petroleum/pri/spt/data/`, {
        params: {
          api_key: this.apiKey,
          frequency: 'daily',
          'data[0]': 'value',
          'facets[product][]': 'EPCBRENT',
          'facets[duessionarea][]': 'NUS',
          'sort[0][column]': 'period',
          'sort[0][direction]': 'desc',
          length: 30
        }
      });

      if (response.data.response) {
        const prices = response.data.response.data.map(item => ({
          date: item.period,
          product: item.product,
          price: parseFloat(item.value) || 0,
          unit: 'USD/barrel'
        }));
        
        logger.info(`Fetched ${prices.length} oil price records from EIA`);
        return prices;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching oil prices from EIA:', error.message);
      return [];
    }
  }

  async fetchProductionFacilities() {
    try {
      const response = await axios.get(`${this.baseUrl}/petroleum/refinery/data/`, {
        params: {
          api_key: this.apiKey,
          frequency: 'annual',
          'data[0]': 'value',
          'facets[duessionarea][]': 'NUS',
          'sort[0][column]': 'period',
          'sort[0][direction]': 'desc',
          length: 100
        }
      });

      if (response.data.response) {
        const facilities = response.data.response.data.map(item => ({
          source: 'eia',
          external_id: `eia_refinery_${item.period}`,
          name: `Refinery ${item.period}`,
          facility_type: 'oil_refinery',
          location: {
            type: 'Point',
            coordinates: [-95.7129, 37.0902] // Default US center
          },
          capacity: parseFloat(item.value) || 0,
          status: 'active',
          country: 'United States'
        }));
        
        logger.info(`Fetched ${facilities.length} refinery records from EIA`);
        return facilities;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching refinery data from EIA:', error.message);
      return [];
    }
  }

  async fetchNaturalGasPrices() {
    try {
      const response = await axios.get(`${this.baseUrl}/natural-gas/pri/sum/data/`, {
        params: {
          api_key: this.apiKey,
          frequency: 'monthly',
          'data[0]': 'value',
          'facets[duessionarea][]': 'NUS',
          'sort[0][column]': 'period',
          'sort[0][direction]': 'desc',
          length: 12
        }
      });

      if (response.data.response) {
        const prices = response.data.response.data.map(item => ({
          date: item.period,
          product: 'natural_gas',
          price: parseFloat(item.value) || 0,
          unit: 'USD/MMBtu'
        }));
        
        logger.info(`Fetched ${prices.length} natural gas price records from EIA`);
        return prices;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching natural gas prices from EIA:', error.message);
      return [];
    }
  }
}

module.exports = new EIAService();
