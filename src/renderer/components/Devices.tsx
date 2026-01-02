import { useState, useEffect } from 'react';
import { Device } from '../types';

function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [syncingDevice, setSyncingDevice] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: 4370,
    location: '',
  });

  useEffect(() => {
    loadDevices();

    const unsubscribe = window.electronAPI.onDeviceSynced((result) => {
      if (result.deviceId === syncingDevice) {
        setSyncingDevice(null);
        loadDevices();
      }
    });

    return () => unsubscribe();
  }, [syncingDevice]);

  const loadDevices = async () => {
    try {
      const data = await window.electronAPI.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDevice) {
        await window.electronAPI.updateDevice(editingDevice.id!, formData);
      } else {
        await window.electronAPI.addDevice({
          ...formData,
          isActive: true,
          lastSync: null,
        });
      }
      setShowModal(false);
      resetForm();
      loadDevices();
    } catch (err) {
      console.error('Error saving device:', err);
      alert('Error saving device');
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      ip: device.ip,
      port: device.port,
      location: device.location,
    });
    setShowModal(true);
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`Delete device "${device.name}"?`)) return;

    try {
      await window.electronAPI.deleteDevice(device.id!);
      loadDevices();
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  const handleToggleActive = async (device: Device) => {
    try {
      await window.electronAPI.updateDevice(device.id!, { isActive: !device.isActive });
      loadDevices();
    } catch (err) {
      console.error('Error toggling device:', err);
    }
  };

  const handleTestConnection = async (device: Device) => {
    setTestingConnection(device.id!);
    try {
      const result = await window.electronAPI.testDeviceConnection(device.ip, device.port);
      if (result.success) {
        alert(`Connection successful!\n\nSerial: ${result.info?.serialNumber || 'N/A'}`);
      } else {
        alert(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Connection error: ${(err as Error).message}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSyncDevice = async (device: Device) => {
    setSyncingDevice(device.id!);
    try {
      const result = await window.electronAPI.syncDevice(device.id!);
      if (result) {
        if (result.success) {
          alert(`Sync complete!\n\nTotal: ${result.totalRecords}\nNew: ${result.recordsAdded}`);
        } else {
          alert(`Sync failed: ${result.error}`);
        }
      }
    } catch (err) {
      alert(`Sync error: ${(err as Error).message}`);
    } finally {
      setSyncingDevice(null);
      loadDevices();
    }
  };

  const resetForm = () => {
    setEditingDevice(null);
    setFormData({ name: '', ip: '', port: 4370, location: '' });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Devices</h2>
        <button
          onClick={openAddModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Device
        </button>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No devices configured yet.</p>
            <button
              onClick={openAddModal}
              className="text-blue-600 hover:text-blue-700"
            >
              Add your first device
            </button>
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                device.isActive ? 'border-green-500' : 'border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">{device.name}</h3>
                  <p className="text-sm text-gray-500">{device.location || 'No location'}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    device.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {device.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">IP:</span>
                  <span className="font-mono text-gray-700">{device.ip}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">Port:</span>
                  <span className="font-mono text-gray-700">{device.port}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">Last Sync:</span>
                  <span className="text-gray-700">
                    {device.lastSync
                      ? new Date(device.lastSync).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTestConnection(device)}
                  disabled={testingConnection === device.id}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {testingConnection === device.id ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={() => handleSyncDevice(device)}
                  disabled={syncingDevice === device.id || !device.isActive}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  {syncingDevice === device.id ? 'Syncing...' : 'Sync'}
                </button>
                <button
                  onClick={() => handleEdit(device)}
                  className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(device)}
                  className={`px-3 py-1 text-sm rounded ${
                    device.isActive
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {device.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(device)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingDevice ? 'Edit Device' : 'Add Device'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Main Entrance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="4370"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Factory A - Ground Floor"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingDevice ? 'Save Changes' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;
