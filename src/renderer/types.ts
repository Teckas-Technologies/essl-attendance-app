// Type declarations for Electron API exposed via preload

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

export interface Stats {
  totalDevices: number;
  activeDevices: number;
  totalAttendance: number;
  todayAttendance: number;
  unsyncedCount: number;
}

export interface SyncResult {
  deviceId: number;
  deviceName: string;
  success: boolean;
  recordsAdded: number;
  totalRecords: number;
  error?: string;
}

export interface Settings {
  apiPort: number;
  pollInterval: number;
  startMinimized: boolean;
  autoStart: boolean;
  cloudBackendUrl: string;
  cloudApiKey: string;
}

export interface Factory {
  id: string;
  factoryName: string;
  factoryCode: string;
  organization: {
    companyName: string;
    companyCode: string;
  };
}

export interface User {
  id: string;
  name: string;
  emailId: string;
  role: string[];
  isKeyUser?: boolean;
  isAuditUser?: boolean;
  autoLogoutMinutes?: number;
  factories?: Factory[];
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface SchedulerStatus {
  isRunning: boolean;
  isSyncing: boolean;
  intervalMs: number;
}

// Electron API interface
export interface ElectronAPI {
  // Device operations
  getDevices: () => Promise<Device[]>;
  getDevice: (id: number) => Promise<Device | null>;
  addDevice: (device: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Device>;
  updateDevice: (id: number, device: Partial<Device>) => Promise<Device | null>;
  deleteDevice: (id: number) => Promise<boolean>;
  testDeviceConnection: (ip: string, port: number) => Promise<{ success: boolean; error?: string; info?: any }>;

  // Attendance operations
  getAttendance: (options: any) => Promise<Attendance[]>;
  getAttendanceCount: (options: any) => Promise<number>;

  // Sync operations
  syncAllDevices: () => Promise<SyncResult[]>;
  syncDevice: (deviceId: number) => Promise<SyncResult | null>;
  getSyncLogs: (deviceId?: number) => Promise<SyncLog[]>;

  // Scheduler operations
  getSchedulerStatus: () => Promise<SchedulerStatus>;
  startScheduler: () => Promise<{ success: boolean }>;
  stopScheduler: () => Promise<{ success: boolean }>;
  setPollInterval: (minutes: number) => Promise<{ success: boolean }>;

  // Stats
  getStats: () => Promise<Stats>;

  // Settings
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>;

  // Authentication
  login: (credentials: { emailId: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<{ success: boolean }>;
  getAuthStatus: () => Promise<AuthStatus>;

  // Window operations
  minimizeToTray: () => Promise<{ success: boolean }>;
  showMessage: (options: { type: string; title: string; message: string }) => Promise<any>;

  // Event listeners
  onSyncStarted: (callback: (data: any) => void) => () => void;
  onDeviceSynced: (callback: (data: SyncResult) => void) => () => void;
  onSyncCompleted: (callback: (data: { results: SyncResult[] }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
