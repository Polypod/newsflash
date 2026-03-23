import React from 'react';

const regions = [
  { id: 'middle-east', name: 'Middle East' },
  { id: 'europe', name: 'Europe' },
  { id: 'asia-pacific', name: 'Asia Pacific' },
  { id: 'americas', name: 'Americas' },
  { id: 'africa', name: 'Africa' },
  { id: 'global', name: 'Global' },
];

export default function RegionFilter({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Region
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All Regions</option>
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </select>
    </div>
  );
}
