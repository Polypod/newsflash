-- Initialize PostgreSQL with PostGIS extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- News articles — metadata only. Vector embeddings live in Chroma (ai-service).
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(100),
  external_id VARCHAR(500) UNIQUE,
  title VARCHAR(500),
  content TEXT,
  published_at TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  sentiment VARCHAR(20),
  relevance_score NUMERIC(3, 2),
  threat_indicators TEXT[],
  url VARCHAR(500),
  category VARCHAR(50),
  author VARCHAR(255),
  criticality_score INTEGER DEFAULT NULL,
  criticality_reason TEXT DEFAULT NULL,
  source_type VARCHAR(50) DEFAULT 'rss',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_headlines
  ON news_articles (source_type, published_at DESC);

-- Conflicts with geospatial indexing
CREATE TABLE IF NOT EXISTS conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50),
  external_id VARCHAR(255) UNIQUE,
  title VARCHAR(255),
  description TEXT,
  event_type VARCHAR(100),
  severity VARCHAR(20),
  location GEOMETRY(Point, 4326),
  region VARCHAR(100),
  country VARCHAR(100),
  event_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_location ON conflicts USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_conflicts_event_date ON conflicts(event_date DESC);

-- Energy facilities
CREATE TABLE IF NOT EXISTS energy_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50),
  external_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  facility_type VARCHAR(100),
  location GEOMETRY(Point, 4326),
  capacity NUMERIC(12, 2),
  status VARCHAR(50),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energy_location ON energy_facilities USING GIST(location);

-- Flights (real-time, auto-truncated after 24h)
CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flight_number VARCHAR(20),
  aircraft_type VARCHAR(50),
  location GEOMETRY(Point, 4326),
  altitude NUMERIC(10, 2),
  speed NUMERIC(10, 2),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flights_timestamp ON flights(timestamp DESC);

-- Analysis cache for LLM queries
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash VARCHAR(255) UNIQUE,
  geopolitical_events JSONB,
  threat_assessment JSONB,
  recommendations JSONB,
  execution_time_ms INT,
  token_usage INT,
  cost_usd NUMERIC(8, 4),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- CAST conflict forecasts (ACLED Conflict Alert System)
-- Rolling 4-week period forecasts; 6 periods ahead per country/admin1.
-- Updated weekly by the cast-sync background job.
CREATE TABLE IF NOT EXISTS cast_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country VARCHAR(100) NOT NULL,
  admin1 VARCHAR(100),
  year INT NOT NULL,
  month INT NOT NULL,
  total_forecast NUMERIC(10, 2),
  battles_forecast NUMERIC(10, 2),
  erv_forecast NUMERIC(10, 2),   -- Explosions/Remote violence
  vac_forecast NUMERIC(10, 2),   -- Violence against civilians
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (country, COALESCE(admin1, ''), year, month)
);

CREATE INDEX IF NOT EXISTS idx_cast_country ON cast_forecasts(country);
CREATE INDEX IF NOT EXISTS idx_cast_period ON cast_forecasts(year, month DESC);

-- UCDP GED events (Georeferenced Event Dataset)
-- Source-cited, academically verified violence events (1989–present, annual releases).
-- type_of_violence: 1=state-based, 2=non-state, 3=one-sided.
-- Fatality columns store best/low/high estimates (UCDP range methodology).
-- Synced daily by the ucdp-ged background job.
CREATE TABLE IF NOT EXISTS ucdp_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(50) UNIQUE NOT NULL,      -- UCDP GED integer id
  conflict_name VARCHAR(255),
  dyad_name VARCHAR(255),
  type_of_violence SMALLINT,                     -- 1/2/3
  event_type VARCHAR(50),                        -- mapped from type_of_violence
  severity VARCHAR(20),
  location GEOMETRY(Point, 4326),
  region VARCHAR(100),
  country VARCHAR(100),
  admin1 VARCHAR(100),
  event_date DATE,
  date_end DATE,
  side_a VARCHAR(255),
  side_b VARCHAR(255),
  fatalities_best INT DEFAULT 0,
  fatalities_low INT DEFAULT 0,
  fatalities_high INT DEFAULT 0,
  source_headline TEXT,
  source_article TEXT,
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ucdp_location ON ucdp_events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_ucdp_event_date ON ucdp_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_ucdp_country ON ucdp_events(country);
CREATE INDEX IF NOT EXISTS idx_ucdp_violence_type ON ucdp_events(type_of_violence);

-- UCDP dyadic conflicts (annual active conflict episodes per actor pair)
-- Tells us which conflicts were active in a given year, at what intensity.
-- intensity_level: 1=minor (25–999 deaths), 2=war (1000+ deaths/year).
-- Synced weekly by the ucdp-context background job.
CREATE TABLE IF NOT EXISTS ucdp_dyadic_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dyad_id VARCHAR(20) NOT NULL,
  conflict_id VARCHAR(20),
  location VARCHAR(255),
  side_a VARCHAR(255),
  side_b VARCHAR(255),
  incompatibility VARCHAR(10),    -- 1=territory, 2=government, 3=both
  intensity_level SMALLINT,       -- 1=minor, 2=war
  type_of_conflict SMALLINT,
  year INT NOT NULL,
  start_date DATE,
  region VARCHAR(100),
  version VARCHAR(10),
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (dyad_id, year)
);

CREATE INDEX IF NOT EXISTS idx_dyadic_year ON ucdp_dyadic_conflicts(year DESC);
CREATE INDEX IF NOT EXISTS idx_dyadic_location ON ucdp_dyadic_conflicts(location);

-- Create a function to clean up old flights
CREATE OR REPLACE FUNCTION cleanup_old_flights()
RETURNS void AS $$
BEGIN
  DELETE FROM flights WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
