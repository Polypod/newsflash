import React from 'react';
import { Source, Layer } from 'react-map-gl';

export default function ConflictLayer({ data = [], visible = true }) {
  if (!visible || !data || data.length === 0) {
    return null;
  }

  const geojson = {
    type: 'FeatureCollection',
    features: data.map((conflict) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: conflict.location?.coordinates || [0, 0],
      },
      properties: {
        id: conflict.id,
        title: conflict.title,
        severity: conflict.severity,
        event_type: conflict.event_type,
        country: conflict.country,
        region: conflict.region,
        event_date: conflict.event_date,
      },
    })),
  };

  const severityColors = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  };

  return (
    <Source id="conflicts" type="geojson" data={geojson}>
      <Layer
        id="conflicts-circle"
        type="circle"
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 4,
            10, 12,
          ],
          'circle-color': [
            'match',
            ['get', 'severity'],
            'low', severityColors.low,
            'medium', severityColors.medium,
            'high', severityColors.high,
            'critical', severityColors.critical,
            '#6B7280',
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="conflicts-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'title'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        }}
        paint={{
          'text-color': '#1F2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        }}
      />
    </Source>
  );
}
