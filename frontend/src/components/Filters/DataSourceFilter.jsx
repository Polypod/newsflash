import React from 'react';

const dataSources = [
  { id: 'acled', name: 'ACLED Conflicts' },
  { id: 'eia', name: 'EIA Energy' },
  { id: 'aviation', name: 'AviationStack Flights' },
  { id: 'news', name: 'News Sources' },
  { id: 'telegram', name: 'Telegram OSINT' },
];

export default function DataSourceFilter({ value, onChange }) {
  const handleToggle = (sourceId) => {
    if (!value) {
      onChange([sourceId]);
    } else if (value.includes(sourceId)) {
      const newValue = value.filter((id) => id !== sourceId);
      onChange(newValue.length > 0 ? newValue : null);
    } else {
      onChange([...value, sourceId]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Data Sources
      </label>
      <div className="flex flex-wrap gap-2">
        {dataSources.map((source) => (
          <button
            key={source.id}
            onClick={() => handleToggle(source.id)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value && value.includes(source.id)
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {source.name}
          </button>
        ))}
      </div>
    </div>
  );
}
