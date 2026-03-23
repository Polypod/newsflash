import React from 'react';
import RegionFilter from './RegionFilter';
import ThreatLevelFilter from './ThreatLevelFilter';
import TimeRangeFilter from './TimeRangeFilter';
import DataSourceFilter from './DataSourceFilter';

export default function FilterPanel({ filters, onFilterChange }) {
  const handleRegionChange = (region) => {
    onFilterChange({ ...filters, region });
  };

  const handleThreatLevelChange = (threatLevel) => {
    onFilterChange({ ...filters, threatLevel });
  };

  const handleTimeRangeChange = (timeRange) => {
    onFilterChange({ ...filters, timeRange });
  };

  const handleDataSourceChange = (dataSource) => {
    onFilterChange({ ...filters, dataSource });
  };

  const handleClearFilters = () => {
    onFilterChange({
      region: null,
      threatLevel: null,
      timeRange: null,
      dataSource: null,
    });
  };

  const hasActiveFilters = filters.region || filters.threatLevel || filters.timeRange || filters.dataSource;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-4">
        <RegionFilter
          value={filters.region}
          onChange={handleRegionChange}
        />

        <ThreatLevelFilter
          value={filters.threatLevel}
          onChange={handleThreatLevelChange}
        />

        <TimeRangeFilter
          value={filters.timeRange}
          onChange={handleTimeRangeChange}
        />

        <DataSourceFilter
          value={filters.dataSource}
          onChange={handleDataSourceChange}
        />
      </div>
    </div>
  );
}
