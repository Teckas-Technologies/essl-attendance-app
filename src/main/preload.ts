/**
 * Preload Script
 * Exposes safe IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the API exposed to the renderer
const electronAPI = {
  // ==================== Device Operations ====================
  getDevices: () => ipcRenderer.invoke('get-devices'),
  getDevice: (id: number) => ipcRenderer.invoke('get-device', id),
  addDevice: (device: any) => ipcRenderer.invoke('add-device', device),
  updateDevice: (id: number, device: any) => ipcRenderer.invoke('update-device', id, device),
  deleteDevice: (id: number) => ipcRenderer.invoke('delete-device', id),
  testDeviceConnection: (ip: string, port: number) => ipcRenderer.invoke('test-device-connection', ip, port),

  // ==================== Attendance Operations ====================
  getAttendance: (options: any) => ipcRenderer.invoke('get-attendance', options),
  getAttendanceCount: (options: any) => ipcRenderer.invoke('get-attendance-count', options),

  // ==================== Sync Operations ====================
  syncAllDevices: () => ipcRenderer.invoke('sync-all-devices'),
  syncDevice: (deviceId: number) => ipcRenderer.invoke('sync-device', deviceId),
  getSyncLogs: (deviceId?: number) => ipcRenderer.invoke('get-sync-logs', deviceId),

  // ==================== Scheduler Operations ====================
  getSchedulerStatus: () => ipcRenderer.invoke('get-scheduler-status'),
  startScheduler: () => ipcRenderer.invoke('start-scheduler'),
  stopScheduler: () => ipcRenderer.invoke('stop-scheduler'),
  setPollInterval: (minutes: number) => ipcRenderer.invoke('set-poll-interval', minutes),

  // ==================== Stats ====================
  getStats: () => ipcRenderer.invoke('get-stats'),

  // ==================== Settings ====================
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  // ==================== Window Operations ====================
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showMessage: (options: { type: string; title: string; message: string }) =>
    ipcRenderer.invoke('show-message', options),

  // ==================== Event Listeners ====================
  onSyncStarted: (callback: (data: any) => void) => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('sync-started', handler);
    return () => ipcRenderer.removeListener('sync-started', handler);
  },

  onDeviceSynced: (callback: (data: any) => void) => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('device-synced', handler);
    return () => ipcRenderer.removeListener('device-synced', handler);
  },

  onSyncCompleted: (callback: (data: any) => void) => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('sync-completed', handler);
    return () => ipcRenderer.removeListener('sync-completed', handler);
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript declarations for the renderer
export type ElectronAPI = typeof electronAPI;
