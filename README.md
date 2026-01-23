# Payroll Care

Desktop application to pull attendance punch data from ZKTeco biometric devices via TCP and expose it through a REST API for cloud server integration.

## Features

- Connect to multiple ESSL/ZKTeco devices via TCP (port 4370)
- Auto-sync attendance data at configurable intervals
- REST API for cloud server integration
- **User authentication via Payroll Care cloud backend**
- **API key protected sync endpoints**
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

## Cloud Integration Setup

Before using the application, you must configure the cloud integration settings.

### Step 1: Configure Cloud Backend URL

1. Open the app and go to **Settings**
2. In the **Cloud Integration** section, enter your **Cloud Backend URL**:
   - Production: `https://your-payroll-care-server.com`
   - Development: `http://localhost:4000`

### Step 2: Register This Server in Cloud Backend

1. In the Payroll Care cloud admin panel, go to **Attendance Sync > Servers**
2. Click **Create Sync Server** and enter:
   - **Name**: A descriptive name (e.g., "Factory A Local Server")
   - **IP Address**: This computer's IP address
   - **Port**: `3000` (or your configured API port)
   - **Organization**: Select your organization
   - **Factory**: Select the factory
3. Click **Create** and **copy the generated API Key**

> **Important:** The full API key is only shown once during creation. Copy it immediately!

### Step 3: Configure API Key

1. Back in the Payroll Care desktop app **Settings**
2. Paste the API key in the **Cloud API Key** field
3. Click **Save Settings**

### Step 4: Login

1. The app will show a login screen
2. Enter your Payroll Care cloud credentials (email and password)
3. Click **Sign In**

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

The app runs a REST API server on **port 3000** (configurable).

**Base URL:** `http://<computer-ip>:3000`

### Authentication

The API uses two authentication mechanisms:

#### 1. API Key Authentication (for Cloud Sync)

Sync endpoints require an API key in the `X-API-Key` header:

```http
GET /api/attendance/sync
X-API-Key: pc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 2. User Authentication (for UI)

User authentication is handled via the cloud backend login.

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | Health check |
| POST | `/api/auth/login` | None | Login via cloud backend |
| POST | `/api/auth/logout` | None | Logout |
| GET | `/api/auth/status` | None | Get auth status |
| GET | `/api/devices` | None | List all devices |
| GET | `/api/attendance` | None | Get attendance with filters |
| GET | `/api/attendance/sync` | **API Key** | Get unsynced records |
| POST | `/api/attendance/mark-synced` | **API Key** | Mark records as synced |
| DELETE | `/api/attendance` | None | Delete all attendance records |
| GET | `/api/stats` | None | Dashboard statistics |
| GET | `/api/sync-logs` | None | Sync history logs |

---

### Authentication Endpoints

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "emailId": "user@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "emailId": "user@example.com",
    "role": ["EMPLOYEE_READ", "ATTENDANCE_WRITE"],
    "factories": [...]
  }
}
```

#### Get Auth Status

```http
GET /api/auth/status
```

**Response:**
```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "emailId": "user@example.com"
  }
}
```

---

### Get Unsynced Attendance (Protected)

```http
GET /api/attendance/sync?limit=1000
X-API-Key: pc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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

### Mark as Synced (Protected)

```http
POST /api/attendance/mark-synced
Content-Type: application/json
X-API-Key: pc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

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

## Cloud Server Integration

Example code for your cloud server to pull data from Payrollcare (with API key):

```javascript
const PAYROLLCARE_URL = 'http://192.168.31.243:3000';
const API_KEY = 'pc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

async function syncAttendance() {
  // 1. Fetch unsynced records (with API key)
  const response = await fetch(`${PAYROLLCARE_URL}/api/attendance/sync?limit=1000`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
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

  // 3. Mark processed records as synced (with API key)
  if (syncedIds.length > 0) {
    await fetch(`${PAYROLLCARE_URL}/api/attendance/mark-synced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
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

### Connection Issues

| Error | Cause | Solution |
|-------|-------|----------|
| Connection timeout | Wrong IP or different subnet | Verify device IP, enable DHCP |
| ECONNREFUSED | Device off or wrong IP | Check device power and IP |
| ECONNRESET | Cloud Server enabled on device | Disable ADMS/Cloud Server |
| No records | No punches on device | Verify device has attendance data |

### Authentication Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Cloud backend URL not configured" | Missing cloud URL | Configure Cloud Backend URL in Settings |
| "Invalid credentials" | Wrong email/password | Check your cloud login credentials |
| "API key required" | Missing X-API-Key header | Include API key header in sync requests |
| "Invalid API key" | Wrong API key | Regenerate API key in cloud backend |
| "API key not configured" | Missing API key in settings | Configure Cloud API Key in Settings |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD BACKEND                                   │
│                         (Payroll Care Server)                               │
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐                │
│  │  Scheduler  │───▶│  Sync Queue  │───▶│  Sync Service   │                │
│  │  (Cron)     │    │              │    │                 │                │
│  └─────────────┘    └──────────────┘    └────────┬────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                         ┌─────────────────┐                │
│                                         │   PostgreSQL    │                │
│                                         └─────────────────┘                │
└─────────────────────────────────────────────────┬───────────────────────────┘
                                                  │
                              HTTP + API Key Auth │
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
        ┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
        │   LOCAL APP #1    │       │   LOCAL APP #2    │       │   LOCAL APP #N    │
        │   (Factory A)     │       │   (Factory B)     │       │   (Factory N)     │
        │                   │       │                   │       │                   │
        │ ┌───────────────┐ │       │ ┌───────────────┐ │       │ ┌───────────────┐ │
        │ │  JSON DB      │ │       │ │  JSON DB      │ │       │ │  JSON DB      │ │
        │ └───────────────┘ │       │ └───────────────┘ │       │ └───────────────┘ │
        │        ▲          │       │        ▲          │       │        ▲          │
        │        │          │       │        │          │       │        │          │
        │ ┌──────┴────────┐ │       │ ┌──────┴────────┐ │       │ ┌──────┴────────┐ │
        │ │  Biometric    │ │       │ │  Biometric    │ │       │ │  Biometric    │ │
        │ │  Device(s)    │ │       │ │  Device(s)    │ │       │ │  Device(s)    │ │
        │ └───────────────┘ │       │ └───────────────┘ │       │ └───────────────┘ │
        └───────────────────┘       └───────────────────┘       └───────────────────┘
```

---

## Environment Configuration

### Settings (configured via UI)

| Setting | Default | Description |
|---------|---------|-------------|
| API Port | 3000 | REST API server port |
| Poll Interval | 5 min | Device polling frequency |
| Cloud Backend URL | - | Payroll Care cloud server URL |
| Cloud API Key | - | API key for sync authentication |
| Start Minimized | false | Start app minimized to tray |
| Auto Start | false | Start with Windows |

---

## Project Structure

```
payrollcare/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App entry point, IPC handlers
│   │   ├── zk-client.ts   # ZKTeco TCP client (zklib)
│   │   ├── database.ts    # JSON database
│   │   ├── api-server.ts  # Express REST API with auth
│   │   ├── scheduler.ts   # Polling scheduler
│   │   └── preload.ts     # IPC bridge
│   └── renderer/          # React UI
│       ├── App.tsx        # Main app with auth routing
│       ├── types.ts       # TypeScript interfaces
│       └── components/
│           ├── Login.tsx      # Login page
│           ├── Dashboard.tsx  # Stats display
│           ├── Devices.tsx    # Device management
│           ├── Attendance.tsx # Attendance records
│           └── Settings.tsx   # Cloud & app settings
├── package.json
└── README.md
```

---

## Security Notes

1. **API Keys**: Keep your API key secure. Never commit it to version control.
2. **Network**: Ensure port 3000 (or configured port) is accessible only from trusted networks.
3. **Cloud URL**: Use HTTPS in production for the cloud backend URL.
4. **Credentials**: User credentials are validated against the cloud backend, not stored locally.

---

## License

MIT
