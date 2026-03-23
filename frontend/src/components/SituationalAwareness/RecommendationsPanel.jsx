import React from 'react';

export default function RecommendationsPanel({ analysis }) {
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No analysis available. Run an analysis to see recommendations.
      </div>
    );
  }

  const recommendations = analysis.recommendations || [];
  const threatLevel = analysis.threat_level || 'low';
  const keyRisks = analysis.key_risks || [];

  const threatLevelColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      {/* Threat Level */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Overall Threat Level</span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          threatLevelColors[threatLevel] || threatLevelColors.low
        }`}>
          {threatLevel.charAt(0).toUpperCase() + threatLevel.slice(1)}
        </span>
      </div>

      {/* Executive Summary */}
      {analysis.executive_summary && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h4>
          <p className="text-sm text-gray-600">{analysis.executive_summary}</p>
        </div>
      )}

      {/* Key Risks */}
      {keyRisks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Key Risks</h4>
          <ul className="space-y-1">
            {keyRisks.map((risk, index) => (
              <li key={index} className="flex items-start space-x-2">
                <svg
                  className="h-5 w-5 text-red-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-sm text-gray-600">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended Actions</h4>
          <ul className="space-y-2">
            {recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-2">
                <svg
                  className="h-5 w-5 text-blue-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-gray-600">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Monitoring Priorities */}
      {analysis.monitoring_priorities && analysis.monitoring_priorities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Monitoring Priorities</h4>
          <ul className="space-y-1">
            {analysis.monitoring_priorities.map((priority, index) => (
              <li key={index} className="flex items-start space-x-2">
                <svg
                  className="h-5 w-5 text-yellow-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span className="text-sm text-gray-600">{priority}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analysis Metadata */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Analysis completed:{' '}
            {analysis.timestamp
              ? new Date(analysis.timestamp).toLocaleString()
              : 'Unknown'}
          </span>
          {analysis.execution_time_ms && (
            <span>Execution time: {analysis.execution_time_ms}ms</span>
          )}
        </div>
        {analysis.token_usage && (
          <div className="mt-1 text-xs text-gray-500">
            Token usage: {analysis.token_usage.toLocaleString()} | Cost: $
            {analysis.cost_usd?.toFixed(4) || '0.0000'}
          </div>
        )}
      </div>
    </div>
  );
}
