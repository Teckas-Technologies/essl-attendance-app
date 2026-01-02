/**
 * Scheduler
 * Handles periodic polling of devices for attendance data
 */

import { ZKClient, AttendanceRecord } from './zk-client';
import { db, Device } from './database';
import { BrowserWindow } from 'electron';

interface SyncResult {
  deviceId: number;
  deviceName: string;
  success: boolean;
  recordsAdded: number;
  totalRecords: number;
  error?: string;
}

type SyncCallback = (result: SyncResult) => void;

class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isSyncing: boolean = false;
  private intervalMs: number = 5 * 60 * 1000; // 5 minutes default
  private onSyncComplete: SyncCallback | null = null;
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set main window for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set sync callback
   */
  setSyncCallback(callback: SyncCallback): void {
    this.onSyncComplete = callback;
  }

  /**
   * Set polling interval
   */
  setInterval(minutes: number): void {
    this.intervalMs = minutes * 60 * 1000;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Start scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log(`[Scheduler] Starting with interval: ${this.intervalMs / 1000 / 60} minutes`);
    this.isRunning = true;

    // Run immediately on start
    this.syncAllDevices();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.syncAllDevices();
    }, this.intervalMs);
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Stopped');
  }

  /**
   * Check if scheduler is running
   */
  getStatus(): { isRunning: boolean; isSyncing: boolean; intervalMs: number } {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      intervalMs: this.intervalMs,
    };
  }

  /**
   * Sync all active devices
   */
  async syncAllDevices(): Promise<SyncResult[]> {
    if (this.isSyncing) {
      console.log('[Scheduler] Already syncing, skipping...');
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];

    try {
      const devices = db.getActiveDevices();
      console.log(`[Scheduler] Syncing ${devices.length} active devices...`);

      // Notify UI that sync started
      this.sendToRenderer('sync-started', { deviceCount: devices.length });

      for (const device of devices) {
        const result = await this.syncDevice(device);
        results.push(result);

        // Notify UI of each device sync
        this.sendToRenderer('device-synced', result);

        if (this.onSyncComplete) {
          this.onSyncComplete(result);
        }
      }

      // Notify UI that sync completed
      this.sendToRenderer('sync-completed', { results });

      console.log('[Scheduler] Sync completed');
    } catch (err) {
      console.error('[Scheduler] Sync error:', err);
    } finally {
      this.isSyncing = false;
    }

    return results;
  }

  /**
   * Sync a single device
   */
  async syncDevice(device: Device): Promise<SyncResult> {
    const result: SyncResult = {
      deviceId: device.id!,
      deviceName: device.name,
      success: false,
      recordsAdded: 0,
      totalRecords: 0,
    };

    const client = new ZKClient(device.ip, device.port);

    try {
      console.log(`[Scheduler] Connecting to ${device.name} (${device.ip}:${device.port})...`);

      // Connect to device
      await client.connect();
      console.log(`[Scheduler] Connected to ${device.name}`);

      // Get attendance records
      const records = await client.getAttendance();
      result.totalRecords = records.length;
      console.log(`[Scheduler] Got ${records.length} records from ${device.name}`);

      // Save records to database
      if (records.length > 0) {
        const dbRecords = records.map((r: AttendanceRecord) => ({
          deviceId: device.id!,
          oderId: r.oderId,
          oderId2: r.oderId2,
          oderId3: r.oderId3,
          userId: r.userId,
          timestamp: r.timestamp,
          status: r.status,
          punch: r.punch,
        }));

        result.recordsAdded = db.addAttendanceBulk(dbRecords);
        console.log(`[Scheduler] Added ${result.recordsAdded} new records from ${device.name}`);
      }

      // Update device last sync time
      db.updateDevice(device.id!, { lastSync: new Date().toISOString() });

      // Log success
      db.addSyncLog({
        deviceId: device.id!,
        syncType: 'pull',
        recordCount: result.recordsAdded,
        status: 'success',
        message: `Pulled ${result.totalRecords} records, ${result.recordsAdded} new`,
      });

      result.success = true;
    } catch (err) {
      const error = err as Error;
      result.error = error.message;
      console.error(`[Scheduler] Error syncing ${device.name}:`, error.message);

      // Log error
      db.addSyncLog({
        deviceId: device.id!,
        syncType: 'pull',
        recordCount: 0,
        status: 'error',
        message: error.message,
      });
    } finally {
      // Disconnect
      await client.disconnect();
    }

    return result;
  }

  /**
   * Manually sync a specific device by ID
   */
  async syncDeviceById(deviceId: number): Promise<SyncResult | null> {
    const device = db.getDevice(deviceId);
    if (!device) {
      return null;
    }

    return this.syncDevice(device);
  }

  /**
   * Test connection to a device
   */
  async testConnection(ip: string, port: number = 4370): Promise<{ success: boolean; error?: string; info?: any }> {
    const client = new ZKClient(ip, port, 10000);

    try {
      await client.connect();
      const info = await client.getDeviceInfo();
      await client.disconnect();

      return {
        success: true,
        info,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Send message to renderer process
   */
  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

export const scheduler = new Scheduler();
export default scheduler;
