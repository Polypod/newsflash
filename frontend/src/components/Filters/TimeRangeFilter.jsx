import React from 'react';

const timeRanges = [
  { id: '1h', name: 'Last Hour' },
  { id: '6h', name: 'Last 6 Hours' },
  { id: '24h', name: 'Last 24 Hours' },
  { id: '7d', name: 'Last 7 Days' },
  { id: '30d', name: 'Last 30 Days' },
  { id: 'custom', name: 'Custom Range' },
];

export default function TimeRangeFilter({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Time Range
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All Time</option>
        {timeRanges.map((range) => (
          <option key={range.id} value={range.id}>
            {range.name}
          </option>
        ))}
      </select>
    </div>
  );
}
