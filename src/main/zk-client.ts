/**
 * ZKTeco Client Wrapper
 * Uses zklib for reliable communication with ESSL/ZKTeco devices
 */

// @ts-ignore - zklib doesn't have TypeScript definitions
import ZKLib from 'zklib';

export interface AttendanceRecord {
  oderId: number;
  oderId2: number;
  oderId3: number;
  userId: string;
  timestamp: Date;
  status: number;
  punch: number;
  uid: number;
}

export interface DeviceInfo {
  serialNumber: string;
  platform: string;
  firmware: string;
  macAddress: string;
}

export interface UserInfo {
  uid: number;
  userId: string;
  name: string;
  privilege: number;
  password: string;
  cardNo: string;
}

export class ZKClient {
  private device: any;
  private ip: string;
  private port: number;
  private connected: boolean = false;

  constructor(ip: string, port: number = 4370, timeout: number = 10000) {
    this.ip = ip;
    this.port = port;
    this.device = new ZKLib({
      ip: ip,
      port: port,
      inport: 5200,
      timeout: timeout,
    });
  }

  /**
   * Connect to device
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.device.connect((err: any) => {
        if (err) {
          this.connected = false;
          reject(new Error(err.message || String(err)));
        } else {
          this.connected = true;
          resolve(true);
        }
      });
    });
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      try {
        this.device.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    this.connected = false;
  }

  /**
   * Get device info
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    return new Promise((resolve) => {
      const info: DeviceInfo = {
        serialNumber: '',
        platform: '',
        firmware: '',
        macAddress: '',
      };

      // zklib doesn't have a direct getDeviceInfo, return basic info
      this.device.getInfo((err: any, data: any) => {
        if (!err && data) {
          info.serialNumber = data.serialNumber || '';
          info.firmware = data.firmwareVersion || '';
        }
        resolve(info);
      });
    });
  }

  /**
   * Get attendance records
   */
  async getAttendance(): Promise<AttendanceRecord[]> {
    return new Promise((resolve, reject) => {
      this.device.getAttendance((err: any, data: any[]) => {
        if (err) {
          console.error('Error getting attendance:', err);
          resolve([]);
          return;
        }

        const records: AttendanceRecord[] = (data || []).map((record: any) => ({
          oderId: 0,
          oderId2: 0,
          oderId3: 0,
          userId: String(record.id || record.uid || ''),
          timestamp: record.timestamp instanceof Date ? record.timestamp : new Date(record.timestamp),
          status: record.state || 0,
          punch: record.type || 0,
          uid: record.uid || 0,
        }));

        resolve(records);
      });
    });
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<UserInfo[]> {
    return new Promise((resolve) => {
      this.device.getUsers((err: any, data: any[]) => {
        if (err) {
          console.error('Error getting users:', err);
          resolve([]);
          return;
        }

        const users: UserInfo[] = (data || []).map((user: any) => ({
          uid: user.uid || 0,
          userId: String(user.userid || user.uid || ''),
          name: user.name || '',
          privilege: user.role || 0,
          password: '',
          cardNo: user.cardno || '',
        }));

        resolve(users);
      });
    });
  }

  /**
   * Clear attendance records
   */
  async clearAttendance(): Promise<boolean> {
    return new Promise((resolve) => {
      this.device.clearAttendanceLog((err: any) => {
        resolve(!err);
      });
    });
  }

  /**
   * Enable device
   */
  async enableDevice(): Promise<boolean> {
    return new Promise((resolve) => {
      this.device.enableDevice((err: any) => {
        resolve(!err);
      });
    });
  }

  /**
   * Disable device
   */
  async disableDevice(): Promise<boolean> {
    return new Promise((resolve) => {
      this.device.disableDevice((err: any) => {
        resolve(!err);
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export default ZKClient;
