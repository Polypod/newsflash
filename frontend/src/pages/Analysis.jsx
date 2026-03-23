import React, { useState } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';
import RecommendationsPanel from '../components/SituationalAwareness/RecommendationsPanel';
import { useSituationalAwareness } from '../hooks/useSituationalAwareness';

export default function Analysis() {
  const [query, setQuery] = useState('');
  const [includeInfrastructure, setIncludeInfrastructure] = useState(true);
  const [threatLevelThreshold, setThreatLevelThreshold] = useState('medium');

  const { data, threatLevel, isLoading, triggerAnalysis } = useSituationalAwareness();

  const handleAnalysisSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    await triggerAnalysis(query);
  };

  const handleQuickAnalysis = async (quickQuery) => {
    setQuery(quickQuery);
    await triggerAnalysis(quickQuery);
  };

  const quickAnalysisOptions = [
    { label: 'Middle East Energy Crisis', query: 'Latest developments in Middle East energy crisis' },
    { label: 'European Security', query: 'Current European security situation and threats' },
    { label: 'Asia Pacific Tensions', query: 'Asia Pacific geopolitical tensions and conflicts' },
    { label: 'Global Cyber Threats', query: 'Global cyber security threats and attacks' },
  ];

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Analysis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Run AI-powered situational awareness analysis
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Analysis Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Analysis Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Analysis</h2>
              <form onSubmit={handleAnalysisSubmit} className="space-y-4">
                <div>
                  <label htmlFor="query" className="block text-sm font-medium text-gray-700">
                    Analysis Query
                  </label>
                  <textarea
                    id="query"
                    rows={4}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe the situation you want to analyze..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      id="includeInfrastructure"
                      type="checkbox"
                      checked={includeInfrastructure}
                      onChange={(e) => setIncludeInfrastructure(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="includeInfrastructure" className="ml-2 block text-sm text-gray-700">
                      Include infrastructure correlation
                    </label>
                  </div>

                  <div>
                    <label htmlFor="threatLevelThreshold" className="block text-sm font-medium text-gray-700">
                      Threat Level Threshold
                    </label>
                    <select
                      id="threatLevelThreshold"
                      value={threatLevelThreshold}
                      onChange={(e) => setThreatLevelThreshold(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    'Run Analysis'
                  )}
                </button>
              </form>
            </div>

            {/* Quick Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Analysis</h2>
              <div className="grid grid-cols-2 gap-4">
                {quickAnalysisOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleQuickAnalysis(option.query)}
                    disabled={isLoading}
                    className="p-4 border border-gray-200 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <h3 className="text-sm font-medium text-gray-900">{option.label}</h3>
                    <p className="mt-1 text-xs text-gray-500">{option.query}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis Results */}
            {data && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Threat Level</label>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        threatLevel === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : threatLevel === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : threatLevel === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {threatLevel?.charAt(0).toUpperCase() + threatLevel?.slice(1) || 'Unknown'}
                    </span>
                  </div>

                  {data.executive_summary && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Executive Summary</label>
                      <p className="mt-1 text-sm text-gray-900">{data.executive_summary}</p>
                    </div>
                  )}

                  {data.geopolitical_events && data.geopolitical_events.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Geopolitical Events ({data.geopolitical_events.length})
                      </label>
                      <ul className="mt-2 space-y-2">
                        {data.geopolitical_events.slice(0, 5).map((event, index) => (
                          <li key={index} className="text-sm text-gray-600">
                            • {event.description || 'No description'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {data.infrastructure_at_risk && data.infrastructure_at_risk.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Infrastructure at Risk ({data.infrastructure_at_risk.length})
                      </label>
                      <ul className="mt-2 space-y-2">
                        {data.infrastructure_at_risk.slice(0, 5).map((item, index) => (
                          <li key={index} className="text-sm text-gray-600">
                            • {item.risk_assessment || 'No assessment'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Recommendations */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendations</h2>
              <RecommendationsPanel analysis={data} />
            </div>
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
