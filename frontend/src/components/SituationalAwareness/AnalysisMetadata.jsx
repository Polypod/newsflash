import React from 'react';

export default function AnalysisMetadata({ analysis }) {
  if (!analysis) {
    return null;
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString();
  };

  const formatCost = (cost) => {
    if (cost === null || cost === undefined) return 'N/A';
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (ms) => {
    if (ms === null || ms === undefined) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Analysis Metadata</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Articles Analyzed</p>
          <p className="text-sm font-medium text-gray-900">
            {formatNumber(analysis.total_articles)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Events Extracted</p>
          <p className="text-sm font-medium text-gray-900">
            {formatNumber(analysis.geopolitical_events?.length || analysis.geopolitical_events)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Infrastructure at Risk</p>
          <p className="text-sm font-medium text-gray-900">
            {formatNumber(analysis.infrastructure_at_risk?.length || analysis.infrastructure_at_risk)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Execution Time</p>
          <p className="text-sm font-medium text-gray-900">
            {formatTime(analysis.execution_time_ms)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Token Usage</p>
          <p className="text-sm font-medium text-gray-900">
            {formatNumber(analysis.token_usage)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Cost</p>
          <p className="text-sm font-medium text-gray-900">
            {formatCost(analysis.cost_usd)}
          </p>
        </div>
      </div>
      {analysis.timestamp && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Analysis completed: {new Date(analysis.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
