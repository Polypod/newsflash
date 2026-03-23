import React from 'react';

export default function CorrelationMatrix({
  data = [],
  title = 'Correlation Matrix',
  height = 300,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No correlation data available
      </div>
    );
  }

  const getCorrelationColor = (value) => {
    if (value >= 0.7) return 'bg-red-500';
    if (value >= 0.5) return 'bg-orange-500';
    if (value >= 0.3) return 'bg-yellow-500';
    if (value >= 0.1) return 'bg-green-500';
    return 'bg-gray-300';
  };

  const getCorrelationIntensity = (value) => {
    if (value >= 0.7) return 'text-white';
    if (value >= 0.5) return 'text-white';
    if (value >= 0.3) return 'text-gray-900';
    if (value >= 0.1) return 'text-gray-900';
    return 'text-gray-600';
  };

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Infrastructure
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Distance (km)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correlation Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk Assessment
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.event_id || 'Unknown'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.infrastructure_ids?.join(', ') || 'Unknown'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {item.distance_km?.toFixed(1) || 'N/A'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center justify-center w-16 px-2 py-1 rounded-full text-xs font-medium ${getCorrelationColor(
                      item.correlation_score
                    )} ${getCorrelationIntensity(item.correlation_score)}`}
                  >
                    {item.correlation_score?.toFixed(2) || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {item.risk_assessment || 'No assessment'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
