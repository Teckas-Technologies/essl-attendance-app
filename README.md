# Payroll Care

Desktop application to pull attendance punch data from ZKTeco biometric devices via TCP and expose it through a REST API for server integration.

## Features

- Connect to multiple ESSL/ZKTeco devices via TCP (port 4370)
- Auto-sync attendance data at configurable intervals
- REST API for external server integration
- Track sync status (synced/unsynced records)
- System tray support for background operation

---

## Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Build the Application

```bash
npm run build
```

### Step 3: Run the Application

```bash
npm start
```

---

## Device Setup

### On the ESSL Device:

1. **Menu > Comm. > Ethernet**
   - Enable **DHCP: ON** (or set static IP in same subnet as your computer)
   - Note the **IP Address** assigned (e.g., `192.168.31.153`)
   - **TCP COMM.Port**: `4370` (default)

2. **Menu > Comm. > Cloud Server / ADMS**
   - Set to **Disabled** (required for PULL mode)

3. **Verify Network**
   - Device and computer must be on the **same subnet**
   - Example: Device `192.168.31.153`, Computer `192.168.31.xxx`

### In Payrollcare App:

1. Go to **Devices** tab
2. Click **+ Add Device**
3. Enter:
   - **Name**: `Factory A Device`
   - **IP Address**: `192.168.31.153`
   - **Port**: `4370`
4. Click **Test** to verify connection
5. Click **Add Device**

---

## API Reference

The app runs a REST API server on **port 3000**.

**Base URL:** `http://<computer-ip>:3000`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/devices` | List all devices |
| GET | `/api/attendance` | Get attendance with filters |
| GET | `/api/attendance/sync` | Get unsynced records |
| POST | `/api/attendance/mark-synced` | Mark records as synced |
| DELETE | `/api/attendance` | Delete all attendance records |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/sync-logs` | Sync history logs |

---

### Get Unsynced Attendance

```http
GET /api/attendance/sync?limit=1000
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "deviceId": 1,
      "userId": "1329",
      "timestamp": "2026-01-07T07:52:04.000Z",
      "status": 1,
      "punch": 0,
      "syncedToCloud": false,
      "createdAt": "2026-01-07T10:30:00.000Z"
    }
  ]
}
```

### Mark as Synced

```http
POST /api/attendance/mark-synced
Content-Type: application/json

{
  "ids": [1, 2, 3, 4, 5]
}
```

### Get Attendance with Filters

```http
GET /api/attendance?startDate=2026-01-01&endDate=2026-01-07&limit=100&offset=0
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| startDate | string | ISO date (YYYY-MM-DD) |
| endDate | string | ISO date (YYYY-MM-DD) |
| userId | string | Filter by user ID |
| deviceId | number | Filter by device |
| limit | number | Records per page (default: 100) |
| offset | number | Skip records (default: 0) |

### Delete All Attendance

```http
DELETE /api/attendance
```

---

## Sync Server Integration

Example code for your sync server to pull data from Payrollcare:

```javascript
const PAYROLLCARE_URL = 'http://192.168.31.243:3000';

async function syncAttendance() {
  // 1. Fetch unsynced records
  const response = await fetch(`${PAYROLLCARE_URL}/api/attendance/sync?limit=1000`);
  const { data } = await response.json();

  if (data.length === 0) {
    console.log('No new records');
    return;
  }

  // 2. Process each punch record
  const syncedIds = [];
  for (const record of data) {
    try {
      await saveToYourDatabase({
        employeeId: record.userId,    // Machine user number
        punchTime: record.timestamp,  // ISO timestamp
        deviceId: record.deviceId
      });
      syncedIds.push(record.id);
    } catch (err) {
      console.error('Failed:', record.id, err.message);
    }
  }

  // 3. Mark processed records as synced
  if (syncedIds.length > 0) {
    await fetch(`${PAYROLLCARE_URL}/api/attendance/mark-synced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: syncedIds })
    });
    console.log(`Synced ${syncedIds.length} records`);
  }
}

// Run every 5 minutes
setInterval(syncAttendance, 5 * 60 * 1000);
syncAttendance();
```

---

## Build for Distribution

```bash
# Windows installer
npm run dist:win

# All platforms
npm run dist
```

Output: `release/` folder

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Connection timeout | Wrong IP or different subnet | Verify device IP, enable DHCP |
| ECONNREFUSED | Device off or wrong IP | Check device power and IP |
| ECONNRESET | Cloud Server enabled on device | Disable ADMS/Cloud Server |
| No records | No punches on device | Verify device has attendance data |

---

## Data Flow

```
ESSL Device (192.168.31.153:4370)
         │
         │ TCP Pull (every 5 min)
         ▼
   Payrollcare Desktop App
         │
         │ REST API (port 3000)
         ▼
   Your Sync Server
         │
         ▼
   Cloud Database
```

---

## Project Structure

```
payrollcare/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App entry point
│   │   ├── zk-client.ts   # ZKTeco TCP client (zklib)
│   │   ├── database.ts    # JSON database
│   │   ├── api-server.ts  # Express REST API
│   │   ├── scheduler.ts   # Polling scheduler
│   │   └── preload.ts     # IPC bridge
│   └── renderer/          # React UI
│       ├── App.tsx
│       └── components/
│           ├── Dashboard.tsx
│           ├── Devices.tsx
│           ├── Attendance.tsx
│           └── Settings.tsx
├── package.json
└── API_README.md          # API quick reference
```

---

## License

MIT
