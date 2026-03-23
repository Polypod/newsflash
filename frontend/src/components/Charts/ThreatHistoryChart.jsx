import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ThreatHistoryChart({
  data = [],
  title = 'Threat Level History',
  height = 300,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No threat history data available
      </div>
    );
  }

  const threatLevelColors = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  };

  const formattedData = data.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    threatScore:
      item.threat_level === 'low'
        ? 1
        : item.threat_level === 'medium'
        ? 2
        : item.threat_level === 'high'
        ? 3
        : 4,
  }));

  const getGradientColor = (value) => {
    if (value <= 1.5) return threatLevelColors.low;
    if (value <= 2.5) return threatLevelColors.medium;
    if (value <= 3.5) return threatLevelColors.high;
    return threatLevelColors.critical;
  };

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            domain={[0, 4]}
            ticks={[1, 2, 3, 4]}
            tickFormatter={(value) => {
              const labels = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
              return labels[value] || '';
            }}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value) => {
              const labels = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
              return [labels[value] || value, 'Threat Level'];
            }}
          />
          <defs>
            <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getGradientColor(4)} stopOpacity={0.8} />
              <stop offset="95%" stopColor={getGradientColor(1)} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="threatScore"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#threatGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
