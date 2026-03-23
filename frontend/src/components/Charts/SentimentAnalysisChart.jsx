import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function SentimentAnalysisChart({
  data = [],
  title = 'Sentiment Analysis',
  height = 300,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No sentiment data available
      </div>
    );
  }

  const sentimentColors = {
    positive: '#10B981',
    neutral: '#6B7280',
    negative: '#EF4444',
  };

  const formattedData = data.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
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
          />
          <Legend />
          <Bar
            dataKey="positive"
            name="Positive"
            fill={sentimentColors.positive}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="neutral"
            name="Neutral"
            fill={sentimentColors.neutral}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="negative"
            name="Negative"
            fill={sentimentColors.negative}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
