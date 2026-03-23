import React from 'react';
import { Source, Layer } from 'react-map-gl';

export default function CorrelationOverlay({ data = [], visible = true }) {
  if (!visible || !data || data.length === 0) {
    return null;
  }

  const geojson = {
    type: 'FeatureCollection',
    features: data.map((correlation) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          correlation.event_location?.coordinates || [0, 0],
          correlation.infrastructure_location?.coordinates || [0, 0],
        ],
      },
      properties: {
        id: correlation.id,
        event_id: correlation.event_id,
        infrastructure_ids: correlation.infrastructure_ids,
        distance_km: correlation.distance_km,
        correlation_score: correlation.correlation_score,
        risk_assessment: correlation.risk_assessment,
      },
    })),
  };

  const getCorrelationColor = (score) => {
    if (score >= 0.7) return '#EF4444';
    if (score >= 0.5) return '#F97316';
    if (score >= 0.3) return '#F59E0B';
    return '#10B981';
  };

  return (
    <Source id="correlations" type="geojson" data={geojson}>
      <Layer
        id="correlations-line"
        type="line"
        paint={{
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'correlation_score'],
            0, '#10B981',
            0.3, '#F59E0B',
            0.5, '#F97316',
            0.7, '#EF4444',
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['get', 'correlation_score'],
            0, 1,
            0.3, 2,
            0.5, 3,
            0.7, 4,
          ],
          'line-opacity': 0.8,
        }}
      />
      <Layer
        id="correlations-label"
        type="symbol"
        layout={{
          'text-field': ['concat', ['to-string', ['round', ['*', ['get', 'correlation_score'], 100]]], '%'],
          'text-size': 10,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-placement': 'line',
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
