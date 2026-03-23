import React from 'react';

const threatLevels = [
  { id: 'low', name: 'Low', color: 'bg-green-100 text-green-800' },
  { id: 'medium', name: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'high', name: 'High', color: 'bg-orange-100 text-orange-800' },
  { id: 'critical', name: 'Critical', color: 'bg-red-100 text-red-800' },
];

export default function ThreatLevelFilter({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Threat Level
      </label>
      <div className="flex flex-wrap gap-2">
        {threatLevels.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(value === level.id ? null : level.id)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === level.id
                ? level.color
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {level.name}
          </button>
        ))}
      </div>
    </div>
  );
}
