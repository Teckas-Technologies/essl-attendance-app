# ESSL Attendance API

REST API for syncing attendance punch data from ESSL/ZKTeco devices.

**Base URL:** `http://<device-ip>:3000`

---

## Get Attendance (Unsynced)

Fetch punch records that haven't been synced to your server yet.

```
GET /api/attendance/sync?limit=1000
```

**Response:**
```json
{
  "success": true,
  "count": 41,
  "data": [
    {
      "id": 1,
      "deviceId": 1,
      "userId": "1329",
      "timestamp": "2025-12-23T12:04:50.000Z",
      "status": 1,
      "punch": 0,
      "syncedToCloud": false,
      "createdAt": "2025-01-07T10:30:00.000Z"
    }
  ]
}
```

---

## Mark as Synced

After processing records, mark them as synced.

```
POST /api/attendance/mark-synced
Content-Type: application/json

{
  "ids": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Marked 5 records as synced"
}
```

---

## Get All Attendance

Fetch with filters and pagination.

```
GET /api/attendance?startDate=2025-01-01&endDate=2025-01-07&limit=100&offset=0
```

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| startDate | string | ISO date (YYYY-MM-DD) |
| endDate | string | ISO date (YYYY-MM-DD) |
| userId | string | Filter by user ID |
| deviceId | number | Filter by device |
| limit | number | Records per page (default: 100) |
| offset | number | Skip records (default: 0) |

---

## Sync Flow Example

```javascript
// 1. Fetch unsynced records
const response = await fetch('http://192.168.31.153:3000/api/attendance/sync');
const { data } = await response.json();

// 2. Process each record
const processedIds = [];
for (const record of data) {
  await saveToYourDatabase({
    oderId: record.userId,
    punchTime: record.timestamp,
    deviceId: record.deviceId
  });
  processedIds.push(record.id);
}

// 3. Mark as synced
await fetch('http://192.168.31.153:3000/api/attendance/mark-synced', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: processedIds })
});
```

---

## Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/devices` | List all devices |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/sync-logs` | Sync history logs |
