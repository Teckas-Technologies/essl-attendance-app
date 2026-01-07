/**
 * Electron Main Process
 * Entry point for the desktop application
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import path from 'path';
import { db } from './database';
import { startApiServer, stopApiServer } from './api-server';
import { scheduler } from './scheduler';
import Store from 'electron-store';

// Initialize electron store for settings
const store = new Store({
  defaults: {
    apiPort: 3000,
    pollInterval: 5, // minutes
    startMinimized: false,
    autoStart: false,
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Payrollcare',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set main window for scheduler
  scheduler.setMainWindow(mainWindow);
}

/**
 * Create system tray
 */
function createTray(): void {
  // Create tray icon (use a simple icon)
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let trayIcon = nativeImage.createEmpty();

  try {
    const loadedIcon = nativeImage.createFromPath(iconPath);
    if (!loadedIcon.isEmpty()) {
      trayIcon = loadedIcon;
    }
  } catch {
    // Use empty icon if file doesn't exist
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Sync Now',
      click: async () => {
        const results = await scheduler.syncAllDevices();
        const total = results.reduce((sum, r) => sum + r.recordsAdded, 0);
        tray?.displayBalloon({
          title: 'Sync Complete',
          content: `Added ${total} new attendance records`,
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Scheduler',
      submenu: [
        {
          label: 'Start',
          click: () => scheduler.start(),
        },
        {
          label: 'Stop',
          click: () => scheduler.stop(),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Payrollcare');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  // ==================== Device Operations ====================

  ipcMain.handle('get-devices', () => {
    return db.getAllDevices();
  });

  ipcMain.handle('get-device', (_event, id: number) => {
    return db.getDevice(id);
  });

  ipcMain.handle('add-device', (_event, device: any) => {
    return db.addDevice(device);
  });

  ipcMain.handle('update-device', (_event, id: number, device: any) => {
    return db.updateDevice(id, device);
  });

  ipcMain.handle('delete-device', (_event, id: number) => {
    return db.deleteDevice(id);
  });

  ipcMain.handle('test-device-connection', async (_event, ip: string, port: number) => {
    return scheduler.testConnection(ip, port);
  });

  // ==================== Attendance Operations ====================

  ipcMain.handle('get-attendance', (_event, options: any) => {
    return db.getAttendance(options);
  });

  ipcMain.handle('get-attendance-count', (_event, options: any) => {
    return db.getAttendanceCount(options);
  });

  // ==================== Sync Operations ====================

  ipcMain.handle('sync-all-devices', async () => {
    return scheduler.syncAllDevices();
  });

  ipcMain.handle('sync-device', async (_event, deviceId: number) => {
    return scheduler.syncDeviceById(deviceId);
  });

  ipcMain.handle('get-sync-logs', (_event, deviceId?: number) => {
    return db.getSyncLogs(deviceId);
  });

  // ==================== Scheduler Operations ====================

  ipcMain.handle('get-scheduler-status', () => {
    return scheduler.getStatus();
  });

  ipcMain.handle('start-scheduler', () => {
    scheduler.start();
    return { success: true };
  });

  ipcMain.handle('stop-scheduler', () => {
    scheduler.stop();
    return { success: true };
  });

  ipcMain.handle('set-poll-interval', (_event, minutes: number) => {
    scheduler.setInterval(minutes);
    store.set('pollInterval', minutes);
    return { success: true };
  });

  // ==================== Stats ====================

  ipcMain.handle('get-stats', () => {
    return db.getStats();
  });

  // ==================== Settings ====================

  ipcMain.handle('get-settings', () => {
    return {
      apiPort: store.get('apiPort'),
      pollInterval: store.get('pollInterval'),
      startMinimized: store.get('startMinimized'),
      autoStart: store.get('autoStart'),
    };
  });

  ipcMain.handle('save-settings', async (_event, settings: any) => {
    if (settings.apiPort !== undefined) {
      const currentPort = store.get('apiPort');
      if (settings.apiPort !== currentPort) {
        await stopApiServer();
        store.set('apiPort', settings.apiPort);
        await startApiServer(settings.apiPort);
      }
    }
    if (settings.pollInterval !== undefined) {
      store.set('pollInterval', settings.pollInterval);
      scheduler.setInterval(settings.pollInterval);
    }
    if (settings.startMinimized !== undefined) {
      store.set('startMinimized', settings.startMinimized);
    }
    if (settings.autoStart !== undefined) {
      store.set('autoStart', settings.autoStart);
      app.setLoginItemSettings({ openAtLogin: settings.autoStart });
    }
    return { success: true };
  });

  // ==================== Window Operations ====================

  ipcMain.handle('minimize-to-tray', () => {
    mainWindow?.hide();
    return { success: true };
  });

  ipcMain.handle('show-message', async (_event, options: { type: string; title: string; message: string }) => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: options.type as any,
      title: options.title,
      message: options.message,
    });
    return result;
  });
}

/**
 * Initialize application
 */
async function initialize(): Promise<void> {
  try {
    // Initialize database
    db.init();
    console.log('[Main] Database initialized');

    // Start API server
    const apiPort = store.get('apiPort') as number;
    await startApiServer(apiPort);
    console.log(`[Main] API server started on port ${apiPort}`);

    // Start scheduler
    const pollInterval = store.get('pollInterval') as number;
    scheduler.setInterval(pollInterval);
    scheduler.start();
    console.log('[Main] Scheduler started');
  } catch (err) {
    console.error('[Main] Initialization error:', err);
    dialog.showErrorBox('Initialization Error', (err as Error).message);
  }
}

/**
 * Cleanup on exit
 */
async function cleanup(): Promise<void> {
  console.log('[Main] Cleaning up...');
  scheduler.stop();
  await stopApiServer();
  db.close();
}

// ==================== App Events ====================

app.whenReady().then(async () => {
  await initialize();
  setupIPC();
  createWindow();
  createTray();

  // Hide window if start minimized is enabled
  if (store.get('startMinimized')) {
    mainWindow?.hide();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit on Windows/Linux, stay in tray
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  await cleanup();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
