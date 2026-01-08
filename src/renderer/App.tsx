import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Devices from './components/Devices';
import Attendance from './components/Attendance';
import Settings from './components/Settings';
import { SchedulerStatus } from './types';

function App() {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus>({
    isRunning: false,
    isSyncing: false,
    intervalMs: 300000,
  });

  useEffect(() => {
    // Load initial scheduler status
    loadSchedulerStatus();

    // Listen for sync events
    const unsubscribeSyncStarted = window.electronAPI.onSyncStarted(() => {
      setSchedulerStatus((prev) => ({ ...prev, isSyncing: true }));
    });

    const unsubscribeSyncCompleted = window.electronAPI.onSyncCompleted(() => {
      setSchedulerStatus((prev) => ({ ...prev, isSyncing: false }));
      loadSchedulerStatus();
    });

    return () => {
      unsubscribeSyncStarted();
      unsubscribeSyncCompleted();
    };
  }, []);

  const loadSchedulerStatus = async () => {
    const status = await window.electronAPI.getSchedulerStatus();
    setSchedulerStatus(status);
  };

  const handleSyncNow = async () => {
    setSchedulerStatus((prev) => ({ ...prev, isSyncing: true }));
    await window.electronAPI.syncAllDevices();
  };

  const toggleScheduler = async () => {
    if (schedulerStatus.isRunning) {
      await window.electronAPI.stopScheduler();
    } else {
      await window.electronAPI.startScheduler();
    }
    loadSchedulerStatus();
  };

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 text-white flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h1 className="text-xl font-bold">Payrollcare</h1>
            <p className="text-sm text-gray-400 mt-1">Device Manager</p>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded transition-colors ${
                      isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/devices"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded transition-colors ${
                      isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                    }`
                  }
                >
                  Devices
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/attendance"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded transition-colors ${
                      isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                    }`
                  }
                >
                  Attendance
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded transition-colors ${
                      isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                    }`
                  }
                >
                  Settings
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Sync Status */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Scheduler</span>
              <button
                onClick={toggleScheduler}
                className={`px-3 py-1 rounded text-xs ${
                  schedulerStatus.isRunning
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                {schedulerStatus.isRunning ? 'Running' : 'Stopped'}
              </button>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={schedulerStatus.isSyncing}
              className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                schedulerStatus.isSyncing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {schedulerStatus.isSyncing ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                  Syncing...
                </span>
              ) : (
                'Sync Now'
              )}
            </button>

            <p className="text-xs text-gray-500 mt-2 text-center">
              Interval: {schedulerStatus.intervalMs / 1000 / 60} min
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
