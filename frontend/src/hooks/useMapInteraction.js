import { useState, useCallback } from 'react';

export function useMapInteraction() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 2,
  });

  const handleMapClick = useCallback((event) => {
    const { features, lngLat } = event;

    if (features && features.length > 0) {
      const feature = features[0];
      setSelectedFeature(feature);
      setPopupInfo({
        longitude: lngLat.lng,
        latitude: lngLat.lat,
        properties: feature.properties,
      });
    } else {
      setSelectedFeature(null);
      setPopupInfo(null);
    }
  }, []);

  const handleMapHover = useCallback((event) => {
    const { features } = event;

    if (features && features.length > 0) {
      setHoveredFeature(features[0]);
    } else {
      setHoveredFeature(null);
    }
  }, []);

  const handleViewStateChange = useCallback((newViewState) => {
    setViewState(newViewState);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFeature(null);
    setPopupInfo(null);
  }, []);

  const flyToLocation = useCallback((longitude, latitude, zoom = 10) => {
    setViewState((prev) => ({
      ...prev,
      longitude,
      latitude,
      zoom,
      transitionDuration: 1000,
    }));
  }, []);

  const resetView = useCallback(() => {
    setViewState({
      longitude: 0,
      latitude: 20,
      zoom: 2,
      transitionDuration: 1000,
    });
  }, []);

  return {
    selectedFeature,
    hoveredFeature,
    popupInfo,
    viewState,
    handleMapClick,
    handleMapHover,
    handleViewStateChange,
    clearSelection,
    flyToLocation,
    resetView,
  };
}
