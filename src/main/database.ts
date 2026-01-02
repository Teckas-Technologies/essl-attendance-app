/**
 * SQLite Database Layer
 * Handles all database operations for devices, attendance, and sync status
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export interface Device {
  id?: number;
  name: string;
  ip: string;
  port: number;
  location: string;
  isActive: boolean;
  lastSync: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attendance {
  id?: number;
  deviceId: number;
  userId: string;
  timestamp: string;
  status: number;
  punch: number;
  syncedToCloud: boolean;
  createdAt?: string;
}

export interface SyncLog {
  id?: number;
  deviceId: number;
  syncType: 'pull' | 'push';
  recordCount: number;
  status: 'success' | 'error';
  message: string;
  createdAt?: string;
}

class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string = '';

  /**
   * Initialize database
   */
  init(customPath?: string): void {
    try {
      this.dbPath = customPath || path.join(app.getPath('userData'), 'attendance.db');
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.createTables();
      console.log('Database initialized at:', this.dbPath);
    } catch (err) {
      console.error('Failed to initialize database:', err);
      throw err;
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Devices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ip TEXT NOT NULL,
        port INTEGER DEFAULT 4370,
        location TEXT DEFAULT '',
        isActive INTEGER DEFAULT 1,
        lastSync TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ip, port)
      )
    `);

    // Attendance table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId INTEGER NOT NULL,
        oderId INTEGER DEFAULT 0,
        oderId2 INTEGER DEFAULT 0,
        oderId3 INTEGER DEFAULT 0,
        userId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status INTEGER DEFAULT 0,
        punch INTEGER DEFAULT 0,
        syncedToCloud INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deviceId) REFERENCES devices(id),
        UNIQUE(deviceId, oderId, oderId2, oderId3, userId, timestamp)
      )
    `);

    // Sync logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId INTEGER NOT NULL,
        syncType TEXT NOT NULL,
        recordCount INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        message TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deviceId) REFERENCES devices(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
      CREATE INDEX IF NOT EXISTS idx_attendance_userId ON attendance(userId);
      CREATE INDEX IF NOT EXISTS idx_attendance_deviceId ON attendance(deviceId);
      CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance(syncedToCloud);
    `);
  }

  // ==================== Device Operations ====================

  /**
   * Add a new device
   */
  addDevice(device: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>): Device {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO devices (name, ip, port, location, isActive, lastSync)
      VALUES (@name, @ip, @port, @location, @isActive, @lastSync)
    `);

    const result = stmt.run({
      name: device.name,
      ip: device.ip,
      port: device.port,
      location: device.location,
      isActive: device.isActive ? 1 : 0,
      lastSync: device.lastSync,
    });

    return this.getDevice(result.lastInsertRowid as number)!;
  }

  /**
   * Get device by ID
   */
  getDevice(id: number): Device | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      ...row,
      isActive: Boolean(row.isActive),
    };
  }

  /**
   * Get all devices
   */
  getAllDevices(): Device[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM devices ORDER BY name');
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      ...row,
      isActive: Boolean(row.isActive),
    }));
  }

  /**
   * Get active devices
   */
  getActiveDevices(): Device[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM devices WHERE isActive = 1 ORDER BY name');
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      ...row,
      isActive: Boolean(row.isActive),
    }));
  }

  /**
   * Update device
   */
  updateDevice(id: number, device: Partial<Device>): Device | null {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any = { id };

    if (device.name !== undefined) {
      fields.push('name = @name');
      values.name = device.name;
    }
    if (device.ip !== undefined) {
      fields.push('ip = @ip');
      values.ip = device.ip;
    }
    if (device.port !== undefined) {
      fields.push('port = @port');
      values.port = device.port;
    }
    if (device.location !== undefined) {
      fields.push('location = @location');
      values.location = device.location;
    }
    if (device.isActive !== undefined) {
      fields.push('isActive = @isActive');
      values.isActive = device.isActive ? 1 : 0;
    }
    if (device.lastSync !== undefined) {
      fields.push('lastSync = @lastSync');
      values.lastSync = device.lastSync;
    }

    fields.push('updatedAt = CURRENT_TIMESTAMP');

    const stmt = this.db.prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = @id`);
    stmt.run(values);

    return this.getDevice(id);
  }

  /**
   * Delete device
   */
  deleteDevice(id: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM devices WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==================== Attendance Operations ====================

  /**
   * Add attendance record (ignores duplicates)
   */
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
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO attendance (deviceId, oderId, oderId2, oderId3, userId, timestamp, status, punch)
      VALUES (@deviceId, @oderId, @oderId2, @oderId3, @userId, @timestamp, @status, @punch)
    `);

    const timestamp = attendance.timestamp instanceof Date
      ? attendance.timestamp.toISOString()
      : attendance.timestamp;

    const result = stmt.run({
      deviceId: attendance.deviceId,
      oderId: attendance.oderId || 0,
      oderId2: attendance.oderId2 || 0,
      oderId3: attendance.oderId3 || 0,
      userId: attendance.userId,
      timestamp,
      status: attendance.status,
      punch: attendance.punch,
    });

    return result.changes;
  }

  /**
   * Add multiple attendance records
   */
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
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO attendance (deviceId, oderId, oderId2, oderId3, userId, timestamp, status, punch)
      VALUES (@deviceId, @oderId, @oderId2, @oderId3, @userId, @timestamp, @status, @punch)
    `);

    let insertedCount = 0;

    const transaction = this.db.transaction((records: typeof records) => {
      for (const record of records) {
        const timestamp = record.timestamp instanceof Date
          ? record.timestamp.toISOString()
          : record.timestamp;

        const result = stmt.run({
          deviceId: record.deviceId,
          oderId: record.oderId || 0,
          oderId2: record.oderId2 || 0,
          oderId3: record.oderId3 || 0,
          userId: record.userId,
          timestamp,
          status: record.status,
          punch: record.punch,
        });

        insertedCount += result.changes;
      }
    });

    transaction(records);
    return insertedCount;
  }

  /**
   * Get attendance records with filters
   */
  getAttendance(options: {
    deviceId?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    syncedToCloud?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Attendance[] {
    if (!this.db) throw new Error('Database not initialized');

    const conditions: string[] = [];
    const params: any = {};

    if (options.deviceId !== undefined) {
      conditions.push('deviceId = @deviceId');
      params.deviceId = options.deviceId;
    }
    if (options.userId !== undefined) {
      conditions.push('userId = @userId');
      params.userId = options.userId;
    }
    if (options.startDate !== undefined) {
      conditions.push('timestamp >= @startDate');
      params.startDate = options.startDate;
    }
    if (options.endDate !== undefined) {
      conditions.push('timestamp <= @endDate');
      params.endDate = options.endDate;
    }
    if (options.syncedToCloud !== undefined) {
      conditions.push('syncedToCloud = @syncedToCloud');
      params.syncedToCloud = options.syncedToCloud ? 1 : 0;
    }

    let sql = 'SELECT * FROM attendance';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY timestamp DESC';

    if (options.limit !== undefined) {
      sql += ' LIMIT @limit';
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      sql += ' OFFSET @offset';
      params.offset = options.offset;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params) as any[];

    return rows.map((row) => ({
      ...row,
      syncedToCloud: Boolean(row.syncedToCloud),
    }));
  }

  /**
   * Get attendance count
   */
  getAttendanceCount(options: {
    deviceId?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    syncedToCloud?: boolean;
  } = {}): number {
    if (!this.db) throw new Error('Database not initialized');

    const conditions: string[] = [];
    const params: any = {};

    if (options.deviceId !== undefined) {
      conditions.push('deviceId = @deviceId');
      params.deviceId = options.deviceId;
    }
    if (options.userId !== undefined) {
      conditions.push('userId = @userId');
      params.userId = options.userId;
    }
    if (options.startDate !== undefined) {
      conditions.push('timestamp >= @startDate');
      params.startDate = options.startDate;
    }
    if (options.endDate !== undefined) {
      conditions.push('timestamp <= @endDate');
      params.endDate = options.endDate;
    }
    if (options.syncedToCloud !== undefined) {
      conditions.push('syncedToCloud = @syncedToCloud');
      params.syncedToCloud = options.syncedToCloud ? 1 : 0;
    }

    let sql = 'SELECT COUNT(*) as count FROM attendance';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const stmt = this.db.prepare(sql);
    const row = stmt.get(params) as any;
    return row.count;
  }

  /**
   * Get unsynced attendance for cloud sync
   */
  getUnsyncedAttendance(limit: number = 1000): Attendance[] {
    return this.getAttendance({ syncedToCloud: false, limit });
  }

  /**
   * Mark attendance as synced to cloud
   */
  markAsSynced(ids: number[]): void {
    if (!this.db) throw new Error('Database not initialized');
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`UPDATE attendance SET syncedToCloud = 1 WHERE id IN (${placeholders})`);
    stmt.run(...ids);
  }

  // ==================== Sync Log Operations ====================

  /**
   * Add sync log
   */
  addSyncLog(log: Omit<SyncLog, 'id' | 'createdAt'>): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO sync_logs (deviceId, syncType, recordCount, status, message)
      VALUES (@deviceId, @syncType, @recordCount, @status, @message)
    `);

    stmt.run(log);
  }

  /**
   * Get sync logs
   */
  getSyncLogs(deviceId?: number, limit: number = 100): SyncLog[] {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM sync_logs';
    const params: any = {};

    if (deviceId !== undefined) {
      sql += ' WHERE deviceId = @deviceId';
      params.deviceId = deviceId;
    }

    sql += ' ORDER BY createdAt DESC LIMIT @limit';
    params.limit = limit;

    const stmt = this.db.prepare(sql);
    return stmt.all(params) as SyncLog[];
  }

  // ==================== Stats ====================

  /**
   * Get dashboard stats
   */
  getStats(): {
    totalDevices: number;
    activeDevices: number;
    totalAttendance: number;
    todayAttendance: number;
    unsyncedCount: number;
  } {
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date().toISOString().split('T')[0];

    const totalDevices = (this.db.prepare('SELECT COUNT(*) as count FROM devices').get() as any).count;
    const activeDevices = (this.db.prepare('SELECT COUNT(*) as count FROM devices WHERE isActive = 1').get() as any).count;
    const totalAttendance = (this.db.prepare('SELECT COUNT(*) as count FROM attendance').get() as any).count;
    const todayAttendance = (this.db.prepare('SELECT COUNT(*) as count FROM attendance WHERE timestamp >= ?').get(today) as any).count;
    const unsyncedCount = (this.db.prepare('SELECT COUNT(*) as count FROM attendance WHERE syncedToCloud = 0').get() as any).count;

    return {
      totalDevices,
      activeDevices,
      totalAttendance,
      todayAttendance,
      unsyncedCount,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new DatabaseManager();
export default db;
