import React from 'react';
import { Source, Layer } from 'react-map-gl';

export default function FlightLayer({ data = [], visible = true }) {
  if (!visible || !data || data.length === 0) {
    return null;
  }

  const geojson = {
    type: 'FeatureCollection',
    features: data.map((flight) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: flight.location?.coordinates || [0, 0],
      },
      properties: {
        id: flight.id,
        flight_number: flight.flight_number,
        aircraft_type: flight.aircraft_type,
        altitude: flight.altitude,
        speed: flight.speed,
        timestamp: flight.timestamp,
      },
    })),
  };

  return (
    <Source id="flights" type="geojson" data={geojson}>
      <Layer
        id="flights-circle"
        type="circle"
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 2,
            10, 8,
          ],
          'circle-color': '#8B5CF6',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="flights-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'flight_number'],
          'text-size': 10,
          'text-offset': [0, 1],
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
