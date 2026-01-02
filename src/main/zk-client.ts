/**
 * ZKTeco TCP Client
 * Implements the ZK protocol for communicating with ESSL/ZKTeco devices
 * Based on the zk-protocol specification: https://github.com/adrobinoga/zk-protocol
 */

import * as net from 'net';

// ZK Protocol Commands
const CMD = {
  CONNECT: 1000,
  EXIT: 1001,
  ENABLE_DEVICE: 1002,
  DISABLE_DEVICE: 1003,
  RESTART: 1004,
  POWEROFF: 1005,
  GET_FREE_SIZES: 50,
  GET_TIME: 201,
  SET_TIME: 202,
  GET_ATTENDANCE: 13,
  CLEAR_ATTENDANCE: 15,
  GET_USERS: 9,
  SET_USER: 8,
  DELETE_USER: 18,
  GET_DEVICE_INFO: 11,
  ACK_OK: 2000,
  ACK_ERROR: 2001,
  ACK_DATA: 2002,
  PREPARE_DATA: 1500,
  DATA: 1501,
  FREE_DATA: 1502,
};

// Response codes
const USHRT_MAX = 65535;

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
  private socket: net.Socket | null = null;
  private ip: string;
  private port: number;
  private timeout: number;
  private sessionId: number = 0;
  private replyId: number = 0;
  private connected: boolean = false;
  private dataBuffer: Buffer = Buffer.alloc(0);

  constructor(ip: string, port: number = 4370, timeout: number = 5000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Create a command packet
   */
  private createHeader(command: number, data: Buffer = Buffer.alloc(0)): Buffer {
    const buf = Buffer.alloc(8 + data.length);
    buf.writeUInt16LE(command, 0);
    buf.writeUInt16LE(0, 2); // checksum placeholder
    buf.writeUInt16LE(this.sessionId, 4);
    buf.writeUInt16LE(this.replyId, 6);
    if (data.length > 0) {
      data.copy(buf, 8);
    }

    // Calculate checksum
    const checksum = this.createChecksum(buf);
    buf.writeUInt16LE(checksum, 2);

    return buf;
  }

  /**
   * Create TCP packet with header
   */
  private createTcpPacket(command: number, data: Buffer = Buffer.alloc(0)): Buffer {
    const header = this.createHeader(command, data);
    const tcpHeader = Buffer.alloc(8);
    tcpHeader.writeUInt16LE(0x5050, 0); // TCP magic
    tcpHeader.writeUInt16LE(0x8282, 2); // TCP magic
    tcpHeader.writeUInt32LE(header.length, 4);
    return Buffer.concat([tcpHeader, header]);
  }

  /**
   * Calculate checksum
   */
  private createChecksum(buf: Buffer): number {
    let checksum = 0;
    for (let i = 0; i < buf.length; i += 2) {
      if (i === 2) continue; // Skip checksum bytes
      const val = i + 1 < buf.length ? buf.readUInt16LE(i) : buf[i];
      checksum += val;
    }
    checksum = (checksum ^ 0xFFFF) + 1;
    return checksum & 0xFFFF;
  }

  /**
   * Parse response header
   */
  private parseResponse(data: Buffer): { command: number; checksum: number; sessionId: number; replyId: number; payload: Buffer } {
    if (data.length < 8) {
      throw new Error('Response too short');
    }

    // Skip TCP header if present
    let offset = 0;
    if (data.length >= 8 && data.readUInt16LE(0) === 0x5050) {
      offset = 8;
    }

    return {
      command: data.readUInt16LE(offset),
      checksum: data.readUInt16LE(offset + 2),
      sessionId: data.readUInt16LE(offset + 4),
      replyId: data.readUInt16LE(offset + 6),
      payload: data.slice(offset + 8),
    };
  }

  /**
   * Send command and wait for response
   */
  private async sendCommand(command: number, data: Buffer = Buffer.alloc(0)): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      const packet = this.createTcpPacket(command, data);
      this.replyId = (this.replyId + 1) & USHRT_MAX;

      let responseData = Buffer.alloc(0);
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, this.timeout);

      const onData = (chunk: Buffer) => {
        responseData = Buffer.concat([responseData, chunk]);

        // Check if we have a complete response
        if (responseData.length >= 16) {
          clearTimeout(timeout);
          this.socket?.removeListener('data', onData);
          resolve(responseData);
        }
      };

      this.socket.on('data', onData);
      this.socket.write(packet);
    });
  }

  /**
   * Connect to device
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, this.timeout);

      this.socket.on('connect', async () => {
        clearTimeout(timeout);
        try {
          const response = await this.sendCommand(CMD.CONNECT);
          const parsed = this.parseResponse(response);

          if (parsed.command === CMD.ACK_OK) {
            this.sessionId = parsed.sessionId;
            this.connected = true;
            resolve(true);
          } else {
            reject(new Error('Connection rejected by device'));
          }
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });

      this.socket.connect(this.port, this.ip);
    });
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.socket) {
      try {
        await this.sendCommand(CMD.EXIT);
      } catch {
        // Ignore disconnect errors
      }
    }
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
    this.sessionId = 0;
    this.replyId = 0;
  }

  /**
   * Get device info
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      serialNumber: '',
      platform: '',
      firmware: '',
      macAddress: '',
    };

    try {
      // Get serial number
      const snData = Buffer.from('~SerialNumber\0');
      const snResponse = await this.sendCommand(CMD.GET_DEVICE_INFO, snData);
      const snParsed = this.parseResponse(snResponse);
      if (snParsed.payload.length > 0) {
        info.serialNumber = snParsed.payload.toString('utf8').replace(/\0/g, '').split('=')[1] || '';
      }
    } catch {
      // Ignore errors for individual info requests
    }

    return info;
  }

  /**
   * Get attendance records
   */
  async getAttendance(): Promise<AttendanceRecord[]> {
    const records: AttendanceRecord[] = [];

    try {
      // Request attendance data
      const response = await this.sendCommand(CMD.GET_ATTENDANCE);
      const parsed = this.parseResponse(response);

      if (parsed.command === CMD.PREPARE_DATA) {
        // Get data size
        const dataSize = parsed.payload.readUInt32LE(0);

        if (dataSize > 0) {
          // Read data in chunks
          let allData = Buffer.alloc(0);

          while (allData.length < dataSize) {
            const dataResponse = await this.sendCommand(CMD.DATA);
            const dataParsed = this.parseResponse(dataResponse);

            if (dataParsed.command === CMD.DATA) {
              allData = Buffer.concat([allData, dataParsed.payload]);
            } else if (dataParsed.command === CMD.ACK_OK) {
              break;
            }
          }

          // Parse attendance records
          // Each record is 40 bytes (newer devices) or 16 bytes (older devices)
          const recordSize = allData.length >= 40 ? 40 : 16;

          for (let i = 0; i + recordSize <= allData.length; i += recordSize) {
            const record = this.parseAttendanceRecord(allData.slice(i, i + recordSize), recordSize);
            if (record) {
              records.push(record);
            }
          }

          // Free data buffer
          await this.sendCommand(CMD.FREE_DATA);
        }
      } else if (parsed.command === CMD.ACK_OK && parsed.payload.length > 0) {
        // Some devices return data directly
        const recordSize = 40;
        for (let i = 0; i + recordSize <= parsed.payload.length; i += recordSize) {
          const record = this.parseAttendanceRecord(parsed.payload.slice(i, i + recordSize), recordSize);
          if (record) {
            records.push(record);
          }
        }
      }
    } catch (err) {
      console.error('Error getting attendance:', err);
    }

    return records;
  }

  /**
   * Parse a single attendance record
   */
  private parseAttendanceRecord(data: Buffer, size: number): AttendanceRecord | null {
    try {
      if (size === 40) {
        // New format (40 bytes)
        const oderId = data.readUInt16LE(0);
        const oderId2 = data.readUInt16LE(2);
        const oderId3 = data.readUInt16LE(4);
        const userId = data.slice(6, 15).toString('utf8').replace(/\0/g, '').trim();
        const timestamp = this.decodeTime(data.readUInt32LE(24));
        const status = data.readUInt8(28);
        const punch = data.readUInt8(29);
        const uid = data.readUInt16LE(32);

        if (!userId) return null;

        return {
          oderId,
          oderId2,
          oderId3,
          userId,
          timestamp,
          status,
          punch,
          uid,
        };
      } else {
        // Old format (16 bytes)
        const uid = data.readUInt16LE(0);
        const userId = data.slice(2, 6).toString('utf8').replace(/\0/g, '').trim() || uid.toString();
        const timestamp = this.decodeTime(data.readUInt32LE(4));
        const status = data.readUInt8(8);
        const punch = data.readUInt8(9);

        if (!userId) return null;

        return {
          oderId: 0,
          oderId2: 0,
          oderId3: 0,
          userId,
          timestamp,
          status,
          punch,
          uid,
        };
      }
    } catch {
      return null;
    }
  }

  /**
   * Decode ZK timestamp to Date
   */
  private decodeTime(timestamp: number): Date {
    const second = timestamp % 60;
    timestamp = Math.floor(timestamp / 60);
    const minute = timestamp % 60;
    timestamp = Math.floor(timestamp / 60);
    const hour = timestamp % 24;
    timestamp = Math.floor(timestamp / 24);
    const day = (timestamp % 31) + 1;
    timestamp = Math.floor(timestamp / 31);
    const month = timestamp % 12;
    timestamp = Math.floor(timestamp / 12);
    const year = timestamp + 2000;

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<UserInfo[]> {
    const users: UserInfo[] = [];

    try {
      const response = await this.sendCommand(CMD.GET_USERS);
      const parsed = this.parseResponse(response);

      if (parsed.command === CMD.PREPARE_DATA) {
        const dataSize = parsed.payload.readUInt32LE(0);

        if (dataSize > 0) {
          let allData = Buffer.alloc(0);

          while (allData.length < dataSize) {
            const dataResponse = await this.sendCommand(CMD.DATA);
            const dataParsed = this.parseResponse(dataResponse);

            if (dataParsed.command === CMD.DATA) {
              allData = Buffer.concat([allData, dataParsed.payload]);
            } else if (dataParsed.command === CMD.ACK_OK) {
              break;
            }
          }

          // Parse user records (72 bytes each for newer devices)
          const recordSize = 72;
          for (let i = 0; i + recordSize <= allData.length; i += recordSize) {
            const user = this.parseUserRecord(allData.slice(i, i + recordSize));
            if (user) {
              users.push(user);
            }
          }

          await this.sendCommand(CMD.FREE_DATA);
        }
      }
    } catch (err) {
      console.error('Error getting users:', err);
    }

    return users;
  }

  /**
   * Parse a single user record
   */
  private parseUserRecord(data: Buffer): UserInfo | null {
    try {
      const uid = data.readUInt16LE(0);
      const privilege = data.readUInt8(2);
      const password = data.slice(3, 11).toString('utf8').replace(/\0/g, '');
      const name = data.slice(11, 35).toString('utf8').replace(/\0/g, '');
      const cardNo = data.readUInt32LE(35).toString();
      const userId = data.slice(48, 57).toString('utf8').replace(/\0/g, '') || uid.toString();

      return {
        uid,
        userId,
        name,
        privilege,
        password,
        cardNo,
      };
    } catch {
      return null;
    }
  }

  /**
   * Clear attendance records
   */
  async clearAttendance(): Promise<boolean> {
    try {
      const response = await this.sendCommand(CMD.CLEAR_ATTENDANCE);
      const parsed = this.parseResponse(response);
      return parsed.command === CMD.ACK_OK;
    } catch {
      return false;
    }
  }

  /**
   * Enable device
   */
  async enableDevice(): Promise<boolean> {
    try {
      const response = await this.sendCommand(CMD.ENABLE_DEVICE);
      const parsed = this.parseResponse(response);
      return parsed.command === CMD.ACK_OK;
    } catch {
      return false;
    }
  }

  /**
   * Disable device
   */
  async disableDevice(): Promise<boolean> {
    try {
      const response = await this.sendCommand(CMD.DISABLE_DEVICE);
      const parsed = this.parseResponse(response);
      return parsed.command === CMD.ACK_OK;
    } catch {
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export default ZKClient;
