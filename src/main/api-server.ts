/**
 * Express API Server
 * Provides REST API endpoints for cloud server integration
 */

import express, { Request, Response, NextFunction } from 'express';
import { db } from './database';
import { Server } from 'http';

const app = express();
let server: Server | null = null;

// Middleware
app.use(express.json());

// CORS middleware for cloud server access
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ==================== Health Check ====================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
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
 * Get attendance for cloud sync
 * Returns unsynced records since a given timestamp
 */
app.get('/api/attendance/sync', (req: Request, res: Response) => {
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
 * Mark attendance as synced to cloud
 * Body: { ids: number[] }
 */
app.post('/api/attendance/mark-synced', (req: Request, res: Response) => {
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
