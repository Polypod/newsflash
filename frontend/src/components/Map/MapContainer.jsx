import React, { useState, useEffect } from 'react';
import Map, { NavigationControl, ScaleControl, FullscreenControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapContainer({
  children,
  initialViewState = {
    longitude: 0,
    latitude: 20,
    zoom: 2,
  },
  style = { width: '100%', height: '100%' },
  onMove,
  onClick,
  interactiveLayerIds = [],
}) {
  const [viewState, setViewState] = useState(initialViewState);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured. Please set VITE_MAPBOX_TOKEN in your environment.');
    }
  }, []);

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center p-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      {...viewState}
      onMove={(evt) => {
        setViewState(evt.viewState);
        onMove?.(evt);
      }}
      onClick={onClick}
      style={style}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={interactiveLayerIds}
    >
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-left" />
      <FullscreenControl position="top-right" />
      {children}
    </Map>
  );
}
