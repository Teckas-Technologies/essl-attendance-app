import { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

function Login({ onLoginSuccess }: LoginProps) {
  const [emailId, setEmailId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [cloudBackendUrl, setCloudBackendUrl] = useState('');
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);

  // Load current settings when modal opens
  useEffect(() => {
    if (showSettings) {
      loadSettings();
    }
  }, [showSettings]);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      setCloudBackendUrl(settings.cloudBackendUrl || '');
      // Check if API key exists but don't show the actual value
      if (settings.cloudApiKey) {
        setHasExistingApiKey(true);
        setCloudApiKey(''); // Don't populate with actual key for security
      } else {
        setHasExistingApiKey(false);
        setCloudApiKey('');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const settingsToSave: { cloudBackendUrl: string; cloudApiKey?: string } = {
        cloudBackendUrl,
      };
      // Only update API key if user entered a new one
      if (cloudApiKey) {
        settingsToSave.cloudApiKey = cloudApiKey;
      }
      await window.electronAPI.saveSettings(settingsToSave);
      setSettingsSaved(true);
      setTimeout(() => {
        setSettingsSaved(false);
        setShowSettings(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.login({ emailId, password });

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Failed to connect to authentication server');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center p-4">
      {/* Settings Button - Top Right */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="Cloud Settings"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {/* Payroll Care Logo */}
            <svg width="50" height="50" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="4" fill="none"/>
              <path d="M35 25h20c11 0 20 9 20 20s-9 20-20 20H45v15H35V25z" fill="white"/>
              <circle cx="55" cy="45" r="8" fill="#059669"/>
              <path d="M52 42c3-3 8-3 11 0" stroke="#059669" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Payroll Care</h1>
          <p className="text-emerald-200 text-sm mt-1">Device Manager</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
              placeholder="user@example.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-center text-xs text-gray-500">
            Sign in with your Payroll Care cloud credentials
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full mt-3 text-center text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Configure cloud settings
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cloud Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloud Backend URL
                </label>
                <input
                  type="url"
                  value={cloudBackendUrl}
                  onChange={(e) => setCloudBackendUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                  placeholder="https://your-cloud-backend.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL of the Payroll Care cloud server
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloud API Key
                  {hasExistingApiKey && !cloudApiKey && (
                    <span className="ml-2 text-xs text-emerald-600 font-normal">
                      (configured)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={cloudApiKey}
                    onChange={(e) => setCloudApiKey(e.target.value)}
                    className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors font-mono text-sm"
                    placeholder={hasExistingApiKey ? '(leave blank to keep current)' : 'pc_xxxxxxxxxxxxxxxxxxxxxxxx'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700 px-2"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {hasExistingApiKey
                    ? 'Enter a new key to replace the existing one, or leave blank to keep it'
                    : 'API key from cloud backend server registration'}
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-blue-700">
                    Configure these settings before logging in. The API key is required for cloud sync functionality.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    savingSettings
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {settingsSaved && (
                <div className="flex items-center justify-center text-emerald-600 text-sm">
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Settings saved!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
