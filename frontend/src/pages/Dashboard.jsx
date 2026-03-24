import React, { useState, useEffect } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';
import StatsCard from '../components/Charts/StatsCard';
import TimeSeriesChart from '../components/Charts/TimeSeriesChart';
import ThreatHistoryChart from '../components/Charts/ThreatHistoryChart';
import SentimentAnalysisChart from '../components/Charts/SentimentAnalysisChart';
import CorrelationMatrix from '../components/Charts/CorrelationMatrix';
import EventTimeline from '../components/SituationalAwareness/EventTimeline';
import NewsIntelligence from '../components/SituationalAwareness/NewsIntelligence';
import RecommendationsPanel from '../components/SituationalAwareness/RecommendationsPanel';
import CastForecastPanel from '../components/SituationalAwareness/CastForecastPanel';
import UCDPConflictsPanel from '../components/SituationalAwareness/UCDPConflictsPanel';
import FilterPanel from '../components/Filters/FilterPanel';
import MapContainer from '../components/Map/MapContainer';
import ConflictLayer from '../components/Map/ConflictLayer';
import EnergyLayer from '../components/Map/EnergyLayer';
import FlightLayer from '../components/Map/FlightLayer';
import CorrelationOverlay from '../components/Map/CorrelationOverlay';
import { useSituationalAwareness } from '../hooks/useSituationalAwareness';
import { useGeospatialData } from '../hooks/useGeospatialData';
import { useCastForecasts } from '../hooks/useCastForecasts';
import { useUCDPData } from '../hooks/useUCDPData';

export default function Dashboard() {
  const [filters, setFilters] = useState({
    region: null,
    threatLevel: null,
    timeRange: null,
    dataSource: null,
  });

  const [mapLayers, setMapLayers] = useState({
    conflicts: true,
    energy: true,
    flights: true,
    correlations: true,
  });

  const { data, threatLevel, isLoading, triggerAnalysis } = useSituationalAwareness();
  const { conflicts, energyFacilities, flights, correlations } = useGeospatialData(filters);
  const { forecasts: liveCastForecasts } = useCastForecasts({ region: filters.region });
  const { events: ucdpEvents, context: ucdpContext } = useUCDPData();
  // Analysis results include CAST enriched with event context; fall back to live feed
  const castForecasts = data?.cast_forecasts?.length ? data.cast_forecasts : liveCastForecasts;
  // UCDP: prefer analysis-enriched data, fall back to live DB query
  const displayUcdpEvents    = data?.ucdp_events?.length    ? data.ucdp_events    : ucdpEvents;
  const displayUcdpConflicts = data?.ucdp_conflicts?.length ? data.ucdp_conflicts : ucdpContext.dyadic;

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleLayerToggle = (layer) => {
    setMapLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  const handleAnalysisSubmit = async (query) => {
    await triggerAnalysis(query);
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time situational awareness and threat assessment
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleAnalysisSubmit('Latest global developments')}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Active Conflicts"
            value={conflicts?.length || 0}
            subtitle="Last 24 hours"
            color="red"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <StatsCard
            title="Energy Facilities"
            value={energyFacilities?.length || 0}
            subtitle="Monitored"
            color="yellow"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <StatsCard
            title="Active Flights"
            value={flights?.length || 0}
            subtitle="Tracked"
            color="purple"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
          <StatsCard
            title="Threat Level"
            value={threatLevel?.charAt(0).toUpperCase() + threatLevel?.slice(1) || 'Low'}
            subtitle="Current assessment"
            color={threatLevel === 'critical' ? 'red' : threatLevel === 'high' ? 'orange' : threatLevel === 'medium' ? 'yellow' : 'green'}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Global Map</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleLayerToggle('conflicts')}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      mapLayers.conflicts ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Conflicts
                  </button>
                  <button
                    onClick={() => handleLayerToggle('energy')}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      mapLayers.energy ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Energy
                  </button>
                  <button
                    onClick={() => handleLayerToggle('flights')}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      mapLayers.flights ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Flights
                  </button>
                  <button
                    onClick={() => handleLayerToggle('correlations')}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      mapLayers.correlations ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Correlations
                  </button>
                </div>
              </div>
              <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer>
                  <ConflictLayer data={conflicts} visible={mapLayers.conflicts} />
                  <EnergyLayer data={energyFacilities} visible={mapLayers.energy} />
                  <FlightLayer data={flights} visible={mapLayers.flights} />
                  <CorrelationOverlay data={correlations} visible={mapLayers.correlations} />
                </MapContainer>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-4">
                <ThreatHistoryChart data={data?.threat_history || []} />
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <SentimentAnalysisChart data={data?.sentiment_analysis || []} />
              </div>
            </div>

            {/* Correlation Matrix */}
            <div className="bg-white rounded-lg shadow p-4">
              <CorrelationMatrix data={correlations || []} />
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Filters */}
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

            {/* Event Timeline */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h3>
              <EventTimeline events={data?.events || []} />
            </div>

            {/* News Intelligence */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">News Intelligence</h3>
              <NewsIntelligence articles={data?.news_articles || []} />
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendations</h3>
              <RecommendationsPanel analysis={data} />
            </div>

            {/* CAST Conflict Forecasts */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Conflict Forecasts</h3>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  ACLED CAST
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Rolling 4-week political violence predictions · 6 periods ahead
              </p>
              <CastForecastPanel forecasts={castForecasts} />
            </div>

            {/* UCDP Verified Conflict Data */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Verified Conflicts</h3>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  UCDP
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Georeferenced events with source citations · state-based, non-state &amp; one-sided violence
              </p>
              <UCDPConflictsPanel events={displayUcdpEvents} conflicts={displayUcdpConflicts} />
            </div>
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
