import { useState, useEffect } from 'react';
import { Settings as SettingsType } from '../types';

function Settings() {
  const [settings, setSettings] = useState<SettingsType>({
    apiPort: 3000,
    pollInterval: 5,
    startMinimized: false,
    autoStart: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await window.electronAPI.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      <div className="bg-white rounded-lg shadow">
        {/* API Settings */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">API Server</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Port
              </label>
              <input
                type="number"
                value={settings.apiPort}
                onChange={(e) =>
                  setSettings({ ...settings, apiPort: parseInt(e.target.value) })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Port for the REST API (cloud server will connect to this)
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">API Endpoints:</p>
              <code className="block text-sm text-gray-600 mb-1">
                GET http://YOUR_IP:{settings.apiPort}/api/attendance/sync
              </code>
              <code className="block text-sm text-gray-600 mb-1">
                POST http://YOUR_IP:{settings.apiPort}/api/attendance/mark-synced
              </code>
              <code className="block text-sm text-gray-600">
                GET http://YOUR_IP:{settings.apiPort}/api/health
              </code>
            </div>
          </div>
        </div>

        {/* Scheduler Settings */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Scheduler</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poll Interval (minutes)
            </label>
            <select
              value={settings.pollInterval}
              onChange={(e) =>
                setSettings({ ...settings, pollInterval: parseInt(e.target.value) })
              }
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 minute</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              How often to pull attendance data from devices
            </p>
          </div>
        </div>

        {/* Application Settings */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Application</h3>

          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.startMinimized}
                onChange={(e) =>
                  setSettings({ ...settings, startMinimized: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700">Start minimized to system tray</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(e) =>
                  setSettings({ ...settings, autoStart: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700">Start automatically with Windows</span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {saved && (
            <span className="text-green-600 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Settings saved!
            </span>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Cloud Integration</h4>
        <p className="text-sm text-blue-700 mb-3">
          To sync attendance data to your cloud server, configure your cloud app to:
        </p>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>
            Periodically call{' '}
            <code className="bg-blue-100 px-1 rounded">GET /api/attendance/sync</code>{' '}
            to fetch new records
          </li>
          <li>
            After processing, call{' '}
            <code className="bg-blue-100 px-1 rounded">POST /api/attendance/mark-synced</code>{' '}
            with the record IDs
          </li>
          <li>Make sure port {settings.apiPort} is accessible from your cloud server</li>
        </ol>
      </div>
    </div>
  );
}

export default Settings;
