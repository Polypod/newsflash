import React from 'react';
import MapContainer from '../Map/MapContainer';
import ConflictLayer from '../Map/ConflictLayer';
import EnergyLayer from '../Map/EnergyLayer';
import CorrelationOverlay from '../Map/CorrelationOverlay';

export default function InfrastructureRiskMap({
  conflicts = [],
  energyFacilities = [],
  correlations = [],
  height = '400px',
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Infrastructure Risk Map</h3>
      <div style={{ height }} className="rounded-lg overflow-hidden">
        <MapContainer>
          <ConflictLayer data={conflicts} visible={true} />
          <EnergyLayer data={energyFacilities} visible={true} />
          <CorrelationOverlay data={correlations} visible={true} />
        </MapContainer>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            <span>Conflicts</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
            <span>Energy Facilities</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            <span>Correlations</span>
          </div>
        </div>
        <div>
          {conflicts.length} conflicts, {energyFacilities.length} facilities, {correlations.length} correlations
        </div>
      </div>
    </div>
  );
}
