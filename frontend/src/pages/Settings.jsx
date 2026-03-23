import React, { useState } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';

export default function Settings() {
  const [apiSettings, setApiSettings] = useState({
    apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws',
    mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN || '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    enableThreatAlerts: true,
    enableConflictUpdates: true,
    enableEnergyAlerts: true,
    enableFlightAlerts: false,
    emailNotifications: false,
    emailAddress: '',
  });

  const [displaySettings, setDisplaySettings] = useState({
    theme: 'light',
    mapStyle: 'light-v11',
    defaultZoom: 2,
    defaultCenter: { lat: 20, lng: 0 },
  });

  const handleApiSettingsChange = (field, value) => {
    setApiSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNotificationSettingsChange = (field, value) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDisplaySettingsChange = (field, value) => {
    setDisplaySettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSettings = () => {
    // Save settings to localStorage or API
    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
    localStorage.setItem('displaySettings', JSON.stringify(displaySettings));
    alert('Settings saved successfully!');
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure your situational awareness platform
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="apiBaseUrl" className="block text-sm font-medium text-gray-700">
                  API Base URL
                </label>
                <input
                  type="text"
                  id="apiBaseUrl"
                  value={apiSettings.apiBaseUrl}
                  onChange={(e) => handleApiSettingsChange('apiBaseUrl', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="wsUrl" className="block text-sm font-medium text-gray-700">
                  WebSocket URL
                </label>
                <input
                  type="text"
                  id="wsUrl"
                  value={apiSettings.wsUrl}
                  onChange={(e) => handleApiSettingsChange('wsUrl', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="mapboxToken" className="block text-sm font-medium text-gray-700">
                  Mapbox Token
                </label>
                <input
                  type="password"
                  id="mapboxToken"
                  value={apiSettings.mapboxToken}
                  onChange={(e) => handleApiSettingsChange('mapboxToken', e.target.value)}
                  placeholder="pk.eyJ1Ijo..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enableThreatAlerts" className="block text-sm font-medium text-gray-700">
                    Threat Alerts
                  </label>
                  <p className="text-xs text-gray-500">Receive notifications for threat level changes</p>
                </div>
                <input
                  type="checkbox"
                  id="enableThreatAlerts"
                  checked={notificationSettings.enableThreatAlerts}
                  onChange={(e) => handleNotificationSettingsChange('enableThreatAlerts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enableConflictUpdates" className="block text-sm font-medium text-gray-700">
                    Conflict Updates
                  </label>
                  <p className="text-xs text-gray-500">Receive notifications for new conflicts</p>
                </div>
                <input
                  type="checkbox"
                  id="enableConflictUpdates"
                  checked={notificationSettings.enableConflictUpdates}
                  onChange={(e) => handleNotificationSettingsChange('enableConflictUpdates', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enableEnergyAlerts" className="block text-sm font-medium text-gray-700">
                    Energy Alerts
                  </label>
                  <p className="text-xs text-gray-500">Receive notifications for energy infrastructure</p>
                </div>
                <input
                  type="checkbox"
                  id="enableEnergyAlerts"
                  checked={notificationSettings.enableEnergyAlerts}
                  onChange={(e) => handleNotificationSettingsChange('enableEnergyAlerts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="enableFlightAlerts" className="block text-sm font-medium text-gray-700">
                    Flight Alerts
                  </label>
                  <p className="text-xs text-gray-500">Receive notifications for flight updates</p>
                </div>
                <input
                  type="checkbox"
                  id="enableFlightAlerts"
                  checked={notificationSettings.enableFlightAlerts}
                  onChange={(e) => handleNotificationSettingsChange('enableFlightAlerts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="emailNotifications" className="block text-sm font-medium text-gray-700">
                    Email Notifications
                  </label>
                  <p className="text-xs text-gray-500">Receive notifications via email</p>
                </div>
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => handleNotificationSettingsChange('emailNotifications', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {notificationSettings.emailNotifications && (
                <div>
                  <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="emailAddress"
                    value={notificationSettings.emailAddress}
                    onChange={(e) => handleNotificationSettingsChange('emailAddress', e.target.value)}
                    placeholder="your@email.com"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Display Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Display Settings</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="theme" className="block text-sm font-medium text-gray-700">
                  Theme
                </label>
                <select
                  id="theme"
                  value={displaySettings.theme}
                  onChange={(e) => handleDisplaySettingsChange('theme', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label htmlFor="mapStyle" className="block text-sm font-medium text-gray-700">
                  Map Style
                </label>
                <select
                  id="mapStyle"
                  value={displaySettings.mapStyle}
                  onChange={(e) => handleDisplaySettingsChange('mapStyle', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="light-v11">Light</option>
                  <option value="dark-v11">Dark</option>
                  <option value="streets-v12">Streets</option>
                  <option value="satellite-v9">Satellite</option>
                </select>
              </div>

              <div>
                <label htmlFor="defaultZoom" className="block text-sm font-medium text-gray-700">
                  Default Zoom Level
                </label>
                <input
                  type="number"
                  id="defaultZoom"
                  min="1"
                  max="20"
                  value={displaySettings.defaultZoom}
                  onChange={(e) => handleDisplaySettingsChange('defaultZoom', parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="lg:col-span-2">
            <button
              onClick={handleSaveSettings}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </DashboardContainer>
  );
}
