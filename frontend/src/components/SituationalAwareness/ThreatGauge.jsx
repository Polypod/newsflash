import React from 'react';

export default function ThreatGauge({ threatLevel = 'low', size = 'medium' }) {
  const getThreatColor = (level) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getThreatTextColor = (level) => {
    switch (level) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getThreatBgColor = (level) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100';
      case 'high':
        return 'bg-orange-100';
      case 'medium':
        return 'bg-yellow-100';
      case 'low':
        return 'bg-green-100';
      default:
        return 'bg-gray-100';
    }
  };

  const getThreatLabel = (level) => {
    switch (level) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Unknown';
    }
  };

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${getThreatBgColor(
          threatLevel
        )}`}
      >
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${getThreatColor(
            threatLevel
          )} bg-opacity-20`}
        >
          <span
            className={`${textSizeClasses[size]} font-bold ${getThreatTextColor(
              threatLevel
            )}`}
          >
            {getThreatLabel(threatLevel)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-700">Threat Level</p>
    </div>
  );
}
