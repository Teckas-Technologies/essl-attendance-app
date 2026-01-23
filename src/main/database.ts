/**
 * Database Layer using LowDB (JSON-based)
 * No native compilation required
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface Device {
  id: number;
  name: string;
  ip: string;
  port: number;
  location: string;
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: number;
  deviceId: number;
  oderId: number;
  oderId2: number;
  oderId3: number;
  userId: string;
  timestamp: string;
  status: number;
  punch: number;
  syncedToCloud: boolean;
  createdAt: string;
}

export interface SyncLog {
  id: number;
  deviceId: number;
  syncType: 'pull' | 'push';
  recordCount: number;
  status: 'success' | 'error';
  message: string;
  createdAt: string;
}

interface DatabaseSchema {
  devices: Device[];
  attendance: Attendance[];
  syncLogs: SyncLog[];
  counters: {
    deviceId: number;
    attendanceId: number;
    syncLogId: number;
  };
}

class DatabaseManager {
  private data: DatabaseSchema;
  private dbPath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = {
      devices: [],
      attendance: [],
      syncLogs: [],
      counters: {
        deviceId: 0,
        attendanceId: 0,
        syncLogId: 0,
      },
    };
  }

  /**
   * Initialize database
   */
  init(customPath?: string): void {
    try {
      this.dbPath = customPath || path.join(app.getPath('userData'), 'database.json');

      // Load existing data if file exists
      if (fs.existsSync(this.dbPath)) {
        const fileContent = fs.readFileSync(this.dbPath, 'utf-8');

        // Handle empty or corrupted file
        if (!fileContent || fileContent.trim() === '') {
          console.warn('Database file is empty, initializing with defaults');
          this.saveSync();
        } else {
          try {
            const parsedData = JSON.parse(fileContent);
            // Validate the data structure has required fields
            if (parsedData && typeof parsedData === 'object') {
              this.data = {
                devices: Array.isArray(parsedData.devices) ? parsedData.devices : [],
                attendance: Array.isArray(parsedData.attendance) ? parsedData.attendance : [],
                syncLogs: Array.isArray(parsedData.syncLogs) ? parsedData.syncLogs : [],
                counters: {
                  deviceId: parsedData.counters?.deviceId || 0,
                  attendanceId: parsedData.counters?.attendanceId || 0,
                  syncLogId: parsedData.counters?.syncLogId || 0,
                },
              };
            } else {
              console.warn('Database file has invalid structure, initializing with defaults');
              this.saveSync();
            }
          } catch (parseError) {
            console.warn('Database file is corrupted, backing up and initializing with defaults');
            // Backup the corrupted file
            const backupPath = this.dbPath + '.backup.' + Date.now();
            try {
              fs.copyFileSync(this.dbPath, backupPath);
              console.log('Corrupted database backed up to:', backupPath);
            } catch {
              // Ignore backup errors
            }
            this.saveSync();
          }
        }
      } else {
        // Save initial empty database
        this.saveSync();
      }

      console.log('Database initialized at:', this.dbPath);
    } catch (err) {
      console.error('Failed to initialize database:', err);
      throw err;
    }
  }

  /**
   * Save database to file (debounced)
   */
  private save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 100);
  }

  /**
   * Save database synchronously
   */
  private saveSync(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  }

  // ==================== Device Operations ====================

  addDevice(device: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>): Device {
    const now = new Date().toISOString();
    const newDevice: Device = {
      ...device,
      id: ++this.data.counters.deviceId,
      createdAt: now,
      updatedAt: now,
    };

    this.data.devices.push(newDevice);
    this.save();
    return newDevice;
  }

  getDevice(id: number): Device | null {
    return this.data.devices.find((d) => d.id === id) || null;
  }

  getAllDevices(): Device[] {
    return [...this.data.devices].sort((a, b) => a.name.localeCompare(b.name));
  }

  getActiveDevices(): Device[] {
    return this.data.devices.filter((d) => d.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  updateDevice(id: number, updates: Partial<Device>): Device | null {
    const index = this.data.devices.findIndex((d) => d.id === id);
    if (index === -1) return null;

    this.data.devices[index] = {
      ...this.data.devices[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.save();
    return this.data.devices[index];
  }

  deleteDevice(id: number): boolean {
    const index = this.data.devices.findIndex((d) => d.id === id);
    if (index === -1) return false;

    this.data.devices.splice(index, 1);
    this.save();
    return true;
  }

  // ==================== Attendance Operations ====================

  addAttendance(attendance: {
    deviceId: number;
    oderId?: number;
    oderId2?: number;
    oderId3?: number;
    userId: string;
    timestamp: Date | string;
    status: number;
    punch: number;
  }): number {
    const timestamp = attendance.timestamp instanceof Date
      ? attendance.timestamp.toISOString()
      : attendance.timestamp;

    // Check for duplicate
    const isDuplicate = this.data.attendance.some(
      (a) =>
        a.deviceId === attendance.deviceId &&
        a.userId === attendance.userId &&
        a.timestamp === timestamp &&
        a.oderId === (attendance.oderId || 0) &&
        a.oderId2 === (attendance.oderId2 || 0) &&
        a.oderId3 === (attendance.oderId3 || 0)
    );

    if (isDuplicate) return 0;

    const newRecord: Attendance = {
      id: ++this.data.counters.attendanceId,
      deviceId: attendance.deviceId,
      oderId: attendance.oderId || 0,
      oderId2: attendance.oderId2 || 0,
      oderId3: attendance.oderId3 || 0,
      userId: attendance.userId,
      timestamp,
      status: attendance.status,
      punch: attendance.punch,
      syncedToCloud: false,
      createdAt: new Date().toISOString(),
    };

    this.data.attendance.push(newRecord);
    this.save();
    return 1;
  }

  addAttendanceBulk(records: Array<{
    deviceId: number;
    oderId?: number;
    oderId2?: number;
    oderId3?: number;
    userId: string;
    timestamp: Date | string;
    status: number;
    punch: number;
  }>): number {
    let insertedCount = 0;

    for (const record of records) {
      insertedCount += this.addAttendance(record);
    }

    return insertedCount;
  }

  getAttendance(options: {
    deviceId?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    syncedToCloud?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Attendance[] {
    let result = [...this.data.attendance];

    // Apply filters
    if (options.deviceId !== undefined) {
      result = result.filter((a) => a.deviceId === options.deviceId);
    }
    if (options.userId !== undefined) {
      result = result.filter((a) => a.userId === options.userId);
    }
    if (options.startDate !== undefined) {
      result = result.filter((a) => a.timestamp >= options.startDate!);
    }
    if (options.endDate !== undefined) {
      result = result.filter((a) => a.timestamp <= options.endDate!);
    }
    if (options.syncedToCloud !== undefined) {
      result = result.filter((a) => a.syncedToCloud === options.syncedToCloud);
    }

    // Sort by timestamp descending
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || result.length;
    result = result.slice(offset, offset + limit);

    return result;
  }

  getAttendanceCount(options: {
    deviceId?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    syncedToCloud?: boolean;
  } = {}): number {
    let result = [...this.data.attendance];

    if (options.deviceId !== undefined) {
      result = result.filter((a) => a.deviceId === options.deviceId);
    }
    if (options.userId !== undefined) {
      result = result.filter((a) => a.userId === options.userId);
    }
    if (options.startDate !== undefined) {
      result = result.filter((a) => a.timestamp >= options.startDate!);
    }
    if (options.endDate !== undefined) {
      result = result.filter((a) => a.timestamp <= options.endDate!);
    }
    if (options.syncedToCloud !== undefined) {
      result = result.filter((a) => a.syncedToCloud === options.syncedToCloud);
    }

    return result.length;
  }

  getUnsyncedAttendance(limit: number = 1000): Attendance[] {
    return this.getAttendance({ syncedToCloud: false, limit });
  }

  markAsSynced(ids: number[]): void {
    for (const id of ids) {
      const record = this.data.attendance.find((a) => a.id === id);
      if (record) {
        record.syncedToCloud = true;
      }
    }
    this.save();
  }

  clearAttendance(): number {
    const count = this.data.attendance.length;
    this.data.attendance = [];
    this.save();
    return count;
  }

  // ==================== Sync Log Operations ====================

  addSyncLog(log: Omit<SyncLog, 'id' | 'createdAt'>): void {
    const newLog: SyncLog = {
      ...log,
      id: ++this.data.counters.syncLogId,
      createdAt: new Date().toISOString(),
    };

    this.data.syncLogs.push(newLog);

    // Keep only last 1000 logs
    if (this.data.syncLogs.length > 1000) {
      this.data.syncLogs = this.data.syncLogs.slice(-1000);
    }

    this.save();
  }

  getSyncLogs(deviceId?: number, limit: number = 100): SyncLog[] {
    let result = [...this.data.syncLogs];

    if (deviceId !== undefined) {
      result = result.filter((l) => l.deviceId === deviceId);
    }

    // Sort by createdAt descending
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return result.slice(0, limit);
  }

  // ==================== Stats ====================

  getStats(): {
    totalDevices: number;
    activeDevices: number;
    totalAttendance: number;
    todayAttendance: number;
    unsyncedCount: number;
  } {
    const today = new Date().toISOString().split('T')[0];

    return {
      totalDevices: this.data.devices.length,
      activeDevices: this.data.devices.filter((d) => d.isActive).length,
      totalAttendance: this.data.attendance.length,
      todayAttendance: this.data.attendance.filter((a) => a.timestamp.startsWith(today)).length,
      unsyncedCount: this.data.attendance.filter((a) => !a.syncedToCloud).length,
    };
  }

  /**
   * Close database (save final state)
   */
  close(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveSync();
  }
}

export const db = new DatabaseManager();
export default db;
