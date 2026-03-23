import React from 'react';

export default function EventTimeline({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No events available
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
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

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, index) => (
          <li key={event.id || index}>
            <div className="relative pb-8">
              {index !== events.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getSeverityColor(
                      event.severity
                    )}`}
                  >
                    <svg
                      className="h-5 w-5 text-white"
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
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {event.event_type || 'Unknown Event'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {event.date
                        ? new Date(event.date).toLocaleDateString()
                        : 'Unknown date'}
                    </p>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <p>{event.description || 'No description available'}</p>
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadge(
                        event.severity
                      )}`}
                    >
                      {event.severity || 'Unknown'}
                    </span>
                    {event.actors && event.actors.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {event.actors.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
