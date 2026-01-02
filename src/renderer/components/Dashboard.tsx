import { useState, useEffect } from 'react';
import { Stats, SyncLog, SyncResult } from '../types';

function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    activeDevices: 0,
    totalAttendance: 0,
    todayAttendance: 0,
    unsyncedCount: 0,
  });
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Listen for sync events
    const unsubscribe = window.electronAPI.onSyncCompleted(() => {
      loadData();
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        window.electronAPI.getStats(),
        window.electronAPI.getSyncLogs(),
      ]);
      setStats(statsData);
      setRecentLogs(logsData.slice(0, 10));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
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
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Devices"
          value={stats.activeDevices}
          subtitle={`of ${stats.totalDevices} total`}
          icon="🖥️"
          color="blue"
        />
        <StatCard
          title="Today's Attendance"
          value={stats.todayAttendance}
          subtitle="records"
          icon="📊"
          color="green"
        />
        <StatCard
          title="Total Records"
          value={stats.totalAttendance}
          subtitle="all time"
          icon="📋"
          color="purple"
        />
        <StatCard
          title="Pending Sync"
          value={stats.unsyncedCount}
          subtitle="to cloud"
          icon="☁️"
          color="orange"
        />
      </div>

      {/* Recent Sync Logs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Sync Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No sync activity yet. Add devices and start syncing!
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(log.createdAt!).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Device #{log.deviceId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.recordCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Cloud Sync API</h4>
        <p className="text-sm text-blue-700">
          Your cloud server can pull attendance data from:
        </p>
        <code className="block mt-2 p-2 bg-blue-100 rounded text-sm text-blue-900">
          GET http://YOUR_IP:3000/api/attendance/sync?since=2024-01-01T00:00:00Z
        </code>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div
          className={`${colorClasses[color]} rounded-full p-3 text-white text-2xl`}
        >
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
