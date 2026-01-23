/**
 * Express API Server
 * Provides REST API endpoints for cloud server integration
 */

import express, { Request, Response, NextFunction } from 'express';
import { db } from './database';
import { Server } from 'http';
import Store from 'electron-store';

const app = express();
let server: Server | null = null;

// Get settings store reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let settingsStore: Store<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setSettingsStore(store: Store<any>): void {
  settingsStore = store;
}

// Type for cloud login response
interface CloudLoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    emailId: string;
    role: string[];
    isKeyUser: boolean;
    isAuditUser: boolean;
    autoLogoutMinutes: number;
    factories: Array<{
      id: string;
      factoryName: string;
      factoryCode: string;
      organization: {
        companyName: string;
        companyCode: string;
      };
    }>;
  };
  message?: string;
}

// Session storage for authenticated user
interface UserSession {
  user: {
    id: string;
    name: string;
    emailId: string;
    role: string[];
    isKeyUser: boolean;
    isAuditUser: boolean;
    autoLogoutMinutes: number;
    factories: Array<{
      id: string;
      factoryName: string;
      factoryCode: string;
      organization: {
        companyName: string;
        companyCode: string;
      };
    }>;
  } | null;
  token: string | null;
}

let currentSession: UserSession = {
  user: null,
  token: null,
};

// Export session management for IPC
export function getSession(): UserSession {
  return currentSession;
}

export function setSession(session: UserSession): void {
  currentSession = session;
}

export function clearSession(): void {
  currentSession = { user: null, token: null };
}

// Middleware
app.use(express.json());

// Handle OPTIONS preflight requests
app.options('*', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.sendStatus(200);
});

// CORS middleware for cloud server access
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  next();
});

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ==================== Authentication Middleware ====================

/**
 * Validate API Key from X-API-Key header
 * Used for cloud backend sync requests
 */
function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const validKey = settingsStore?.get('cloudApiKey') as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required. Provide X-API-Key header.',
    });
    return;
  }

  if (!validKey) {
    res.status(503).json({
      success: false,
      error: 'API key not configured. Please configure the cloud API key in settings.',
    });
    return;
  }

  if (apiKey !== validKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  (req as any).authType = 'api-key';
  next();
}

// ==================== Health Check ====================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ==================== Authentication Routes ====================

/**
 * Login via Cloud Backend
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { emailId, password } = req.body;

  if (!emailId || !password) {
    res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
    return;
  }

  const cloudUrl = settingsStore?.get('cloudBackendUrl') as string | undefined;
  if (!cloudUrl) {
    res.status(503).json({
      success: false,
      error: 'Cloud backend URL not configured. Please configure it in settings.',
    });
    return;
  }

  try {
    const response = await fetch(`${cloudUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, password }),
    });

    const data = (await response.json()) as CloudLoginResponse;

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: data.message || 'Login failed',
      });
      return;
    }

    // Store session
    currentSession.token = data.token;
    currentSession.user = data.user;

    console.log(`[Auth] User logged in: ${data.user.name}`);

    res.json({
      success: true,
      user: {
        id: data.user.id,
        name: data.user.name,
        emailId: data.user.emailId,
        role: data.user.role,
        isKeyUser: data.user.isKeyUser,
        isAuditUser: data.user.isAuditUser,
        factories: data.user.factories,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to authentication server',
    });
  }
});

/**
 * Logout
 */
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  const userName = currentSession.user?.name;
  currentSession = { user: null, token: null };
  console.log(`[Auth] User logged out: ${userName}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Get auth status
 */
app.get('/api/auth/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    isAuthenticated: currentSession.token !== null,
    user: currentSession.user
      ? {
          id: currentSession.user.id,
          name: currentSession.user.name,
          emailId: currentSession.user.emailId,
          role: currentSession.user.role,
          factories: currentSession.user.factories,
        }
      : null,
  });
});

// ==================== Devices ====================

/**
 * Get all devices
 */
app.get('/api/devices', (_req: Request, res: Response) => {
  try {
    const devices = db.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Get single device
 */
app.get('/api/devices/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const device = db.getDevice(id);
    if (!device) {
      res.status(404).json({ success: false, error: 'Device not found' });
      return;
    }
    res.json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Add new device
 */
app.post('/api/devices', (req: Request, res: Response) => {
  try {
    const { name, ip, port = 4370, location = '' } = req.body;

    if (!name || !ip) {
      res.status(400).json({ success: false, error: 'Name and IP are required' });
      return;
    }

    const device = db.addDevice({
      name,
      ip,
      port,
      location,
      isActive: true,
      lastSync: null,
    });

    res.status(201).json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Update device
 */
app.put('/api/devices/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const device = db.updateDevice(id, req.body);
    if (!device) {
      res.status(404).json({ success: false, error: 'Device not found' });
      return;
    }
    res.json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Delete device
 */
app.delete('/api/devices/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = db.deleteDevice(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Device not found' });
      return;
    }
    res.json({ success: true, message: 'Device deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ==================== Attendance ====================

/**
 * Get attendance records
 * Query params: deviceId, userId, startDate, endDate, limit, offset
 */
app.get('/api/attendance', (req: Request, res: Response) => {
  try {
    const {
      deviceId,
      userId,
      startDate,
      endDate,
      limit = '100',
      offset = '0',
    } = req.query;

    const options: any = {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    if (deviceId) options.deviceId = parseInt(deviceId as string, 10);
    if (userId) options.userId = userId as string;
    if (startDate) options.startDate = startDate as string;
    if (endDate) options.endDate = endDate as string;

    const attendance = db.getAttendance(options);
    const total = db.getAttendanceCount(options);

    res.json({
      success: true,
      data: attendance,
      pagination: {
        total,
        limit: options.limit,
        offset: options.offset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Get attendance for cloud sync (Protected with API Key)
 * Returns unsynced records since a given timestamp
 */
app.get('/api/attendance/sync', validateApiKey, (req: Request, res: Response) => {
  try {
    const { since, limit = '1000' } = req.query;

    const options: any = {
      syncedToCloud: false,
      limit: parseInt(limit as string, 10),
    };

    if (since) {
      options.startDate = since as string;
    }

    const attendance = db.getAttendance(options);

    res.json({
      success: true,
      data: attendance,
      count: attendance.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Mark attendance as synced to cloud (Protected with API Key)
 * Body: { ids: number[] }
 */
app.post('/api/attendance/mark-synced', validateApiKey, (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids array is required' });
      return;
    }

    db.markAsSynced(ids);
    res.json({ success: true, message: `Marked ${ids.length} records as synced` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * Delete all attendance records
 */
app.delete('/api/attendance', (_req: Request, res: Response) => {
  try {
    const count = db.clearAttendance();
    res.json({ success: true, message: `Deleted ${count} records` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ==================== Stats ====================

/**
 * Get dashboard stats
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ==================== Sync Logs ====================

/**
 * Get sync logs
 */
app.get('/api/sync-logs', (req: Request, res: Response) => {
  try {
    const { deviceId, limit = '100' } = req.query;
    const logs = db.getSyncLogs(
      deviceId ? parseInt(deviceId as string, 10) : undefined,
      parseInt(limit as string, 10)
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ==================== Server Control ====================

/**
 * Start API server
 */
export function startApiServer(port: number = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(port, '0.0.0.0', () => {
        console.log(`[API] Server running on http://0.0.0.0:${port}`);
        resolve();
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[API] Port ${port} is already in use`);
        }
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Stop API server
 */
export function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[API] Server stopped');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get Express app instance (for IPC)
 */
export function getApp() {
  return app;
}

export default { startApiServer, stopApiServer, getApp };
