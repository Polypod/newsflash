import React from 'react';
import { Source, Layer } from 'react-map-gl';

export default function EnergyLayer({ data = [], visible = true }) {
  if (!visible || !data || data.length === 0) {
    return null;
  }

  const geojson = {
    type: 'FeatureCollection',
    features: data.map((facility) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: facility.location?.coordinates || [0, 0],
      },
      properties: {
        id: facility.id,
        name: facility.name,
        facility_type: facility.facility_type,
        capacity: facility.capacity,
        status: facility.status,
        country: facility.country,
      },
    })),
  };

  const facilityColors = {
    oil_refinery: '#F59E0B',
    power_plant: '#3B82F6',
    natural_gas: '#10B981',
    nuclear: '#EF4444',
    renewable: '#8B5CF6',
  };

  return (
    <Source id="energy" type="geojson" data={geojson}>
      <Layer
        id="energy-circle"
        type="circle"
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 3,
            10, 10,
          ],
          'circle-color': [
            'match',
            ['get', 'facility_type'],
            'oil_refinery', facilityColors.oil_refinery,
            'power_plant', facilityColors.power_plant,
            'natural_gas', facilityColors.natural_gas,
            'nuclear', facilityColors.nuclear,
            'renewable', facilityColors.renewable,
            '#6B7280',
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="energy-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
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
