import React, { useState } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';
import MapContainer from '../components/Map/MapContainer';
import FlightLayer from '../components/Map/FlightLayer';
import FilterPanel from '../components/Filters/FilterPanel';
import { useGeospatialData } from '../hooks/useGeospatialData';

export default function Flights() {
  const [filters, setFilters] = useState({
    region: null,
    threatLevel: null,
    timeRange: null,
    dataSource: null,
  });

  const [selectedFlight, setSelectedFlight] = useState(null);
  const { flights } = useGeospatialData(filters);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleFlightClick = (flight) => {
    setSelectedFlight(flight);
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flight Tracking</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor global flight activity and aviation infrastructure
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map and List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Flight Map</h2>
              <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer>
                  <FlightLayer data={flights} visible={true} />
                </MapContainer>
              </div>
            </div>

            {/* Flight List */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Flights</h2>
              <div className="space-y-4">
                {flights && flights.length > 0 ? (
                  flights.map((flight) => (
                    <div
                      key={flight.id}
                      onClick={() => handleFlightClick(flight)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFlight?.id === flight.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {flight.flight_number || 'Unknown Flight'}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {flight.aircraft_type || 'Unknown aircraft'}
                          </p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
                              {flight.altitude ? `${Math.round(flight.altitude)} ft` : 'Altitude unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {flight.speed ? `${Math.round(flight.speed)} kts` : 'Speed unknown'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {flight.timestamp
                            ? new Date(flight.timestamp).toLocaleTimeString()
                            : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active flights found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Filters and Details */}
          <div className="space-y-6">
            {/* Filters */}
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

            {/* Selected Flight Details */}
            {selectedFlight && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Flight Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Flight Number</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedFlight.flight_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Aircraft Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedFlight.aircraft_type || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Altitude</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedFlight.altitude ? `${Math.round(selectedFlight.altitude)} feet` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Speed</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedFlight.speed ? `${Math.round(selectedFlight.speed)} knots` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Update</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedFlight.timestamp
                        ? new Date(selectedFlight.timestamp).toLocaleString()
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
