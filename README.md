# ESSL Attendance Desktop App

A Windows desktop application to pull attendance data from ESSL/ZKTeco biometric devices via TCP port 4370.

## Features

- **Device Management**: Add, edit, and remove ESSL/ZKTeco devices
- **Automatic Polling**: Pull attendance data every 5 minutes (configurable)
- **REST API**: Expose endpoints for cloud server integration
- **Dashboard**: View stats and recent sync activity
- **Attendance Viewer**: Browse and filter attendance records
- **System Tray**: Runs in background with tray icon

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP APP                          │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐           │
│  │ ZK TCP      │  │ Express     │  │ Scheduler      │           │
│  │ Client      │  │ API Server  │  │ (5 min poll)   │           │
│  │ (Port 4370) │  │ (Port 3000) │  │                │           │
│  └─────────────┘  └─────────────┘  └────────────────┘           │
│                         │                                        │
│              ┌──────────┴──────────┐                            │
│              │   SQLite Database   │                            │
│              └─────────────────────┘                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   REACT UI                               │    │
│  │  Dashboard | Devices | Attendance | Settings             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Development mode
npm run dev        # Start Vite dev server
npm run dev:main   # Compile main process (in another terminal)
npm start          # Run Electron (in another terminal)

# Production build
npm run build      # Build both main and renderer
npm run dist:win   # Create Windows installer
```

## API Endpoints

The app exposes REST API on port 3000 (configurable):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/devices` | GET | List all devices |
| `/api/attendance` | GET | Get attendance records |
| `/api/attendance/sync` | GET | Get unsynced records for cloud |
| `/api/attendance/mark-synced` | POST | Mark records as synced |
| `/api/stats` | GET | Dashboard statistics |

### Cloud Sync Example

Your cloud server can pull attendance data like this:

```javascript
// 1. Fetch unsynced records
const response = await fetch('http://LOCAL_IP:3000/api/attendance/sync?since=2024-01-01');
const { data } = await response.json();

// 2. Process records in your cloud app
for (const record of data) {
  await saveToCloudDatabase(record);
}

// 3. Mark as synced
await fetch('http://LOCAL_IP:3000/api/attendance/mark-synced', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: data.map(r => r.id) })
});
```

## Device Configuration

1. Open the app and go to **Devices** tab
2. Click **Add Device**
3. Enter device details:
   - **Name**: Friendly name (e.g., "Main Entrance")
   - **IP**: Device IP address (e.g., "192.168.1.100")
   - **Port**: TCP port (default: 4370)
   - **Location**: Optional location info
4. Click **Test** to verify connection
5. Click **Sync** to pull attendance data

## Network Requirements

- Desktop app must be on the same network as ESSL devices
- Port 4370 must be accessible on devices
- Port 3000 (or configured API port) must be accessible from cloud server

## Project Structure

```
essl-attendance-app/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App entry point
│   │   ├── zk-client.ts      # ZKTeco TCP client
│   │   ├── database.ts       # SQLite operations
│   │   ├── api-server.ts     # Express REST API
│   │   ├── scheduler.ts      # Polling scheduler
│   │   └── preload.ts        # IPC bridge
│   └── renderer/             # React UI
│       ├── App.tsx
│       └── components/
│           ├── Dashboard.tsx
│           ├── Devices.tsx
│           ├── Attendance.tsx
│           └── Settings.tsx
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.config.ts
└── tailwind.config.js
```

## Troubleshooting

### Connection Failed
- Verify device IP is correct
- Ensure port 4370 is not blocked by firewall
- Check if device is powered on and connected to network

### No Attendance Records
- Ensure employees have punched on the device
- Check device has attendance data in its memory
- Try manual sync from the Devices page

### Cloud Can't Connect
- Verify API port (default 3000) is accessible
- Check firewall allows incoming connections
- Ensure correct IP address is used

## License

MIT
