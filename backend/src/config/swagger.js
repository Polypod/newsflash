const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Situational Awareness MVP API',
      version: '1.0.0',
      description: 'Production-Grade AI-Powered Situational Awareness Platform API',
      contact: {
        name: 'API Support',
        email: 'support@situational-awareness.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.situational-awareness.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR'
            },
            message: {
              type: 'string',
              example: 'Invalid request parameters'
            }
          }
        },
        Conflict: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            source: {
              type: 'string',
              example: 'acled'
            },
            external_id: {
              type: 'string'
            },
            title: {
              type: 'string'
            },
            description: {
              type: 'string'
            },
            event_type: {
              type: 'string',
              enum: ['conflict', 'diplomatic', 'trade', 'military', 'cyber']
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            },
            location: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  example: 'Point'
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number'
                  },
                  example: [0, 0]
                }
              }
            },
            region: {
              type: 'string'
            },
            country: {
              type: 'string'
            },
            event_date: {
              type: 'string',
              format: 'date'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        EnergyFacility: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            source: {
              type: 'string',
              example: 'eia'
            },
            external_id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            facility_type: {
              type: 'string',
              enum: ['oil_refinery', 'power_plant', 'pipeline', 'lng_terminal']
            },
            location: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  example: 'Point'
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number'
                  },
                  example: [0, 0]
                }
              }
            },
            capacity: {
              type: 'number'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'maintenance']
            },
            country: {
              type: 'string'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Flight: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            source: {
              type: 'string',
              example: 'aviationstack'
            },
            external_id: {
              type: 'string'
            },
            flight_number: {
              type: 'string'
            },
            airline: {
              type: 'string'
            },
            aircraft_type: {
              type: 'string'
            },
            departure_airport: {
              type: 'string'
            },
            departure_iata: {
              type: 'string'
            },
            arrival_airport: {
              type: 'string'
            },
            arrival_iata: {
              type: 'string'
            },
            flight_status: {
              type: 'string',
              enum: ['active', 'landed', 'cancelled', 'scheduled']
            },
            location: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  example: 'Point'
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number'
                  },
                  example: [0, 0]
                }
              }
            },
            altitude: {
              type: 'number'
            },
            speed: {
              type: 'number'
            },
            heading: {
              type: 'number'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        NewsArticle: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            source: {
              type: 'string'
            },
            external_id: {
              type: 'string'
            },
            title: {
              type: 'string'
            },
            content: {
              type: 'string'
            },
            url: {
              type: 'string',
              format: 'uri'
            },
            published_at: {
              type: 'string',
              format: 'date-time'
            },
            category: {
              type: 'string',
              enum: ['geopolitical', 'military', 'energy', 'cyber', 'trade', 'humanitarian', 'osint', 'analysis']
            },
            author: {
              type: 'string'
            }
          }
        },
        AnalysisRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              example: 'Latest developments in Middle East energy crisis'
            },
            include_infrastructure: {
              type: 'boolean',
              default: true
            },
            threat_level_threshold: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              default: 'medium'
            }
          }
        },
        AnalysisResponse: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            threat_level: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            },
            total_articles: {
              type: 'integer'
            },
            geopolitical_events: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/GeopoliticalEvent'
              }
            },
            infrastructure_at_risk: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/InfrastructureCorrelation'
              }
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            execution_time_ms: {
              type: 'integer'
            },
            token_usage: {
              type: 'integer'
            },
            cost_usd: {
              type: 'number',
              format: 'float'
            }
          }
        },
        GeopoliticalEvent: {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['conflict', 'diplomatic', 'trade', 'military', 'cyber']
            },
            actors: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            location: {
              type: 'string'
            },
            date: {
              type: 'string',
              format: 'date'
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            },
            description: {
              type: 'string'
            }
          }
        },
        InfrastructureCorrelation: {
          type: 'object',
          properties: {
            event_id: {
              type: 'string'
            },
            infrastructure_ids: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            distance_km: {
              type: 'number',
              format: 'float'
            },
            correlation_score: {
              type: 'number',
              format: 'float'
            },
            risk_assessment: {
              type: 'string'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/v1/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
