import React, { useState } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';
import MapContainer from '../components/Map/MapContainer';
import ConflictLayer from '../components/Map/ConflictLayer';
import FilterPanel from '../components/Filters/FilterPanel';
import CastForecastPanel from '../components/SituationalAwareness/CastForecastPanel';
import UCDPConflictsPanel from '../components/SituationalAwareness/UCDPConflictsPanel';
import { useGeospatialData } from '../hooks/useGeospatialData';
import { useCastForecasts } from '../hooks/useCastForecasts';
import { useUCDPData } from '../hooks/useUCDPData';

export default function Conflicts() {
  const [filters, setFilters] = useState({
    region: null,
    threatLevel: null,
    timeRange: null,
    dataSource: null,
  });

  const [selectedConflict, setSelectedConflict] = useState(null);
  const { conflicts } = useGeospatialData(filters);
  const { forecasts: castForecasts } = useCastForecasts({ region: filters.region });
  const { events: ucdpEvents, context: ucdpContext } = useUCDPData();

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleConflictClick = (conflict) => {
    setSelectedConflict(conflict);
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conflicts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor global conflict events and geopolitical developments
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map and List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Conflict Map</h2>
              <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer>
                  <ConflictLayer data={conflicts} visible={true} />
                </MapContainer>
              </div>
            </div>

            {/* Conflict List */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Conflicts</h2>
              <div className="space-y-4">
                {conflicts && conflicts.length > 0 ? (
                  conflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      onClick={() => handleConflictClick(conflict)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedConflict?.id === conflict.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {conflict.title || 'Untitled Conflict'}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {conflict.country || 'Unknown location'}
                          </p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                conflict.severity === 'critical'
                                  ? 'bg-red-100 text-red-800'
                                  : conflict.severity === 'high'
                                  ? 'bg-orange-100 text-orange-800'
                                  : conflict.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {conflict.severity || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {conflict.event_type || 'Unknown type'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {conflict.event_date
                            ? new Date(conflict.event_date).toLocaleDateString()
                            : 'Unknown date'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No conflicts found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Filters and Details */}
          <div className="space-y-6">
            {/* Filters */}
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

            {/* CAST Conflict Forecasts */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Conflict Forecasts</h3>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  CAST
                </span>
              </div>
              <CastForecastPanel forecasts={castForecasts} />
            </div>

            {/* UCDP Verified Conflict Data */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Verified Conflicts</h3>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  UCDP
                </span>
              </div>
              <UCDPConflictsPanel events={ucdpEvents} conflicts={ucdpContext.dyadic} />
            </div>

            {/* Selected Conflict Details */}
            {selectedConflict && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conflict Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedConflict.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedConflict.description || 'No description available'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedConflict.country}, {selectedConflict.region}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Event Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedConflict.event_type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        selectedConflict.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : selectedConflict.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : selectedConflict.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {selectedConflict.severity}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedConflict.event_date
                        ? new Date(selectedConflict.event_date).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
