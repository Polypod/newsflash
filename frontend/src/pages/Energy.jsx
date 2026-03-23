import React, { useState } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';
import MapContainer from '../components/Map/MapContainer';
import EnergyLayer from '../components/Map/EnergyLayer';
import FilterPanel from '../components/Filters/FilterPanel';
import { useGeospatialData } from '../hooks/useGeospatialData';

export default function Energy() {
  const [filters, setFilters] = useState({
    region: null,
    threatLevel: null,
    timeRange: null,
    dataSource: null,
  });

  const [selectedFacility, setSelectedFacility] = useState(null);
  const { energyFacilities } = useGeospatialData(filters);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleFacilityClick = (facility) => {
    setSelectedFacility(facility);
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Energy Infrastructure</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor global energy facilities and infrastructure
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map and List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Energy Facilities Map</h2>
              <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer>
                  <EnergyLayer data={energyFacilities} visible={true} />
                </MapContainer>
              </div>
            </div>

            {/* Facility List */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Energy Facilities</h2>
              <div className="space-y-4">
                {energyFacilities && energyFacilities.length > 0 ? (
                  energyFacilities.map((facility) => (
                    <div
                      key={facility.id}
                      onClick={() => handleFacilityClick(facility)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFacility?.id === facility.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {facility.name || 'Unnamed Facility'}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {facility.country || 'Unknown location'}
                          </p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                facility.facility_type === 'oil_refinery'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : facility.facility_type === 'power_plant'
                                  ? 'bg-blue-100 text-blue-800'
                                  : facility.facility_type === 'natural_gas'
                                  ? 'bg-green-100 text-green-800'
                                  : facility.facility_type === 'nuclear'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {facility.facility_type || 'Unknown type'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {facility.capacity ? `${facility.capacity} MW` : 'Capacity unknown'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {facility.status || 'Unknown status'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No energy facilities found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Filters and Details */}
          <div className="space-y-6">
            {/* Filters */}
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

            {/* Selected Facility Details */}
            {selectedFacility && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Facility Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedFacility.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedFacility.facility_type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedFacility.country}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Capacity</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedFacility.capacity ? `${selectedFacility.capacity} MW` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        selectedFacility.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : selectedFacility.status === 'maintenance'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedFacility.status || 'Unknown'}
                    </span>
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
