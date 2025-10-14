# Homebridge Integration - Implementation Roadmap

**Project**: PC Remote Wake + Homebridge Integration
**Goal**: Control Windows PCs through Apple HomeKit via Homebridge
**Timeline**: 4-6 weeks (phased delivery)
**Complexity**: Moderate

---

## Executive Summary

This roadmap provides a phased approach to integrate your PC Remote Wake webapp with Homebridge, enabling HomeKit control of Windows PCs on your local network. The implementation adds:

✅ **Wake Up**: Trigger via HomeKit "Turn On" command (uses existing /api/wake)
✅ **Sleep Mode**: Trigger via HomeKit "Turn Off" → SSH sleep command
✅ **Shutdown**: Alternative to sleep (user-configurable)
✅ **Status Monitoring**: HomeKit shows real-time PC online/offline state
✅ **Remote Desktop**: Optional RDP link generation (MVP approach)

**Total Effort**: 21-35 hours across 4 phases

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Apple Home App                        │
│                     (iPhone, iPad, Mac)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ HomeKit Protocol (HAP)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Homebridge (Raspberry Pi)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         PC Remote Wake Plugin (homebridge-*)           │ │
│  │  - Device Discovery                                     │ │
│  │  - Status Polling (adaptive: 5s-300s intervals)        │ │
│  │  - Power State Management                              │ │
│  │  - API Client with JWT authentication                  │ │
│  └─────────────┬──────────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────────┘
                 │ HTTPS/HTTP REST API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│            PC Remote Wake Webapp (Next.js)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Enhanced Middleware (Dual Authentication)              │ │
│  │  - JWT Cookie Auth (browser users)                     │ │
│  │  - Bearer Token Auth (Homebridge/API clients)          │ │
│  └─────────────┬──────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Endpoints                                           │ │
│  │  GET  /api/devices - List devices                      │ │
│  │  POST /api/wake    - Send WOL magic packet             │ │
│  │  POST /api/status  - Check online/RDP ready            │ │
│  │  POST /api/sleep   - SSH sleep command                 │ │
│  │  POST /api/shutdown - SSH shutdown command             │ │
│  │  POST /api/keys    - API key management (NEW)          │ │
│  └─────────────┬──────────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────────┘
                 │ Network Actions
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ PC #1  │  │ PC #2  │  │ PC #3  │
│ Gaming │  │ Office │  │ Server │
└────────┘  └────────┘  └────────┘
```

**Key Architectural Decisions** (from `homebridge-architecture-design.md`):
- **Authentication**: Dual-layer (JWT cookies + bearer tokens)
- **HomeKit Mapping**: Each PC → Switch accessory (ON/OFF)
- **Status Sync**: Adaptive polling (5s transitions, 60s stable, 300s offline)
- **Performance**: ~4,000 API calls/day for 5 devices (manageable)

---

## Phase 1: API Authentication Layer (Week 1)

**Objective**: Enable Homebridge to authenticate with webapp without browser cookies

**Effort**: 6-9 hours
**Priority**: 🔴 Critical (blocks plugin development)

### 1.1 Database Schema Changes

**File**: `lib/db.ts`

Add API keys table:
```typescript
// Add to database initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
`);
```

**Database functions**:
```typescript
export const apiKeyDb = {
  create: (keyHash: string, name: string, userId: number) => { ... },
  getByHash: (keyHash: string) => { ... },
  updateLastUsed: (keyHash: string) => { ... },
  getAllForUser: (userId: number) => { ... },
  deleteById: (id: number) => { ... }
};
```

**Testing**:
```bash
# Create test key
openssl rand -hex 32
# Expected: 64-character hex string
```

**Effort**: 1.5 hours

---

### 1.2 Middleware Enhancement

**File**: `middleware.ts`

Add bearer token authentication before JWT cookie check:

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths (unchanged)
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // NEW: Check for Bearer token (API key authentication)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7); // Remove "Bearer "
    const keyHash = await hashApiKey(apiKey); // bcrypt hash
    const apiKeyRecord = apiKeyDb.getByHash(keyHash);

    if (apiKeyRecord) {
      apiKeyDb.updateLastUsed(keyHash); // Track usage
      return NextResponse.next(); // Allow request
    }
    // Invalid API key → fall through to cookie check
  }

  // EXISTING: JWT cookie authentication (unchanged)
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifySession(token);
  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  return NextResponse.next();
}
```

**Key Points**:
- Bearer token checked FIRST (faster path for API clients)
- Falls back to cookie auth if no valid bearer token
- bcrypt hashing for API keys (10 rounds, same as passwords)
- Tracks `last_used_at` for security auditing

**Effort**: 2 hours

---

### 1.3 API Key Management Endpoints

**File**: `app/api/keys/route.ts` (NEW)

```typescript
// POST /api/keys - Generate new API key
export async function POST(request: NextRequest) {
  const session = await getSession(); // Requires logged-in user
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await request.json();
  const apiKey = generateSecureApiKey(); // 32-byte hex string
  const keyHash = await bcrypt.hash(apiKey, 10);

  const record = apiKeyDb.create(keyHash, name, session.userId);

  return NextResponse.json({
    id: record.id,
    name: record.name,
    key: apiKey, // ONLY TIME KEY IS SHOWN
    created_at: record.created_at
  });
}

// GET /api/keys - List user's API keys
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = apiKeyDb.getAllForUser(session.userId);
  return NextResponse.json({ keys }); // WITHOUT raw keys
}

// DELETE /api/keys/[id] - Revoke API key
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(request.nextUrl.pathname.split('/').pop()!);
  apiKeyDb.deleteById(id);

  return NextResponse.json({ success: true });
}
```

**Effort**: 2 hours

---

### 1.4 UI for API Key Management

**File**: `app/page.tsx` (enhance existing dashboard)

Add "API Keys" section:
```tsx
<section className="api-keys">
  <h2>API Keys</h2>
  <button onClick={generateApiKey}>Generate New Key</button>

  {apiKeys.map(key => (
    <div key={key.id}>
      <span>{key.name}</span>
      <span>Created: {key.created_at}</span>
      <span>Last used: {key.last_used_at || 'Never'}</span>
      <button onClick={() => revokeKey(key.id)}>Revoke</button>
    </div>
  ))}

  {newKey && (
    <div className="alert">
      <strong>Save this key securely (shown once):</strong>
      <code>{newKey}</code>
    </div>
  )}
</section>
```

**Effort**: 1.5 hours

---

### 1.5 Testing & Validation

```bash
# 1. Generate API key via UI
# 2. Test with curl
curl -H "Authorization: Bearer YOUR_API_KEY_HERE" \
     http://100.66.154.21:3000/api/devices

# Expected: JSON list of devices

# 3. Test invalid key
curl -H "Authorization: Bearer invalid_key" \
     http://100.66.154.21:3000/api/devices

# Expected: 307 redirect to /login (fallback to cookie auth)

# 4. Test no auth
curl http://100.66.154.21:3000/api/devices

# Expected: 307 redirect to /login
```

**Effort**: 1 hour

---

**Phase 1 Deliverables**:
- ✅ API keys table in SQLite database
- ✅ Bearer token authentication in middleware
- ✅ API key CRUD endpoints
- ✅ Dashboard UI for key management
- ✅ End-to-end authentication testing

**Phase 1 Total**: 6-9 hours

---

## Phase 2: Homebridge Plugin Development (Week 2-3)

**Objective**: Create custom Homebridge plugin for PC control

**Effort**: 12-18 hours
**Priority**: 🟡 High (core functionality)

### 2.1 Plugin Project Setup

**Directory**: `homebridge-pc-remote-wake/` (separate npm package)

```bash
# Initialize plugin project
mkdir homebridge-pc-remote-wake
cd homebridge-pc-remote-wake
npm init -y

# Install dependencies
npm install homebridge axios
npm install --save-dev @types/node typescript

# TypeScript config
npx tsc --init
```

**File**: `package.json`
```json
{
  "name": "homebridge-pc-remote-wake",
  "version": "1.0.0",
  "description": "Homebridge plugin for PC Remote Wake webapp",
  "main": "dist/index.js",
  "keywords": ["homebridge-plugin", "wake-on-lan", "pc-control"],
  "engines": {
    "homebridge": ">=1.6.0",
    "node": ">=18.0.0"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "peerDependencies": {
    "homebridge": ">=1.6.0"
  }
}
```

**Effort**: 1 hour

---

### 2.2 Core Plugin Structure

**Files**:
- `src/index.ts` - Plugin entry point
- `src/platform.ts` - Platform controller (device discovery)
- `src/accessory.ts` - Switch accessory for each PC
- `src/api-client.ts` - HTTP client for webapp API
- `src/types.ts` - TypeScript interfaces
- `src/constants.ts` - Configuration constants

**File**: `src/index.ts`
```typescript
import { API } from 'homebridge';
import { PcRemoteWakePlatform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './constants';

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, PcRemoteWakePlatform);
};
```

**File**: `src/constants.ts`
```typescript
export const PLUGIN_NAME = 'homebridge-pc-remote-wake';
export const PLATFORM_NAME = 'PcRemoteWake';

export const POLLING_INTERVALS = {
  TRANSITIONING_ON: 5000,    // 5 seconds during wake
  TRANSITIONING_OFF: 10000,  // 10 seconds during shutdown/sleep
  STABLE_ONLINE: 60000,      // 1 minute when PC is on
  STABLE_OFFLINE: 300000,    // 5 minutes when PC is off
  ERROR_BACKOFF_BASE: 120000 // 2 minutes base for exponential backoff
};

export const WAKE_TIMEOUT_MS = 120000; // 2 minutes max wait for wake
```

**Effort**: 2 hours

---

### 2.3 API Client Implementation

**File**: `src/api-client.ts`

Full implementation (see `homebridge-plugin-specification.md` Section 5):
- JWT token management with refresh
- Retry logic (3 attempts, exponential backoff)
- All endpoint methods: `login()`, `getDevices()`, `wakeDevice()`, `checkStatus()`, `sleepDevice()`, `shutdownDevice()`
- Error handling with typed responses

**Key features**:
- Automatic re-authentication on 401 errors
- Request timeout (10 seconds)
- Debug logging mode
- Axios instance with interceptors

**Effort**: 3 hours

---

### 2.4 Platform Controller

**File**: `src/platform.ts`

Responsibilities:
1. **Discover devices** from webapp API on startup
2. **Create/update/remove** HomeKit accessories dynamically
3. **Periodic re-discovery** (every 5 minutes)
4. **Configuration validation**

```typescript
export class PcRemoteWakePlatform implements DynamicPlatformPlugin {
  private readonly accessories: PlatformAccessory[] = [];
  private apiClient: ApiClient;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.apiClient = new ApiClient(config, log);

    this.api.on('didFinishLaunching', async () => {
      await this.discoverDevices();
      // Re-discover every 5 minutes
      setInterval(() => this.discoverDevices(), 300000);
    });
  }

  async discoverDevices() {
    const devices = await this.apiClient.getDevices();

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.mac_address);
      const existing = this.accessories.find(acc => acc.UUID === uuid);

      if (existing) {
        // Update existing accessory
        new PcAccessory(this, existing, device);
      } else {
        // Create new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);
        new PcAccessory(this, accessory, device);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
```

**Effort**: 3 hours

---

### 2.5 Switch Accessory Implementation

**File**: `src/accessory.ts`

Each PC → HomeKit Switch with adaptive polling:

```typescript
export class PcAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private currentState: 'on' | 'off' | 'transitioning_on' | 'transitioning_off' = 'off';

  constructor(
    private readonly platform: PcRemoteWakePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: Device
  ) {
    // Set accessory information
    this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'PC Remote Wake')
      .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Windows PC')
      .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, device.mac_address);

    // Get or create Switch service
    this.service = this.accessory.getService(this.platform.api.hap.Service.Switch)
      || this.accessory.addService(this.platform.api.hap.Service.Switch);

    this.service.setCharacteristic(this.platform.api.hap.Characteristic.Name, device.name);

    // Register handlers
    this.service.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    // Start status polling
    this.startPolling();
  }

  async handleOnGet(): Promise<CharacteristicValue> {
    const status = await this.platform.apiClient.checkStatus(this.device.ip_address);
    return status.online;
  }

  async handleOnSet(value: CharacteristicValue) {
    const targetState = value as boolean;

    if (targetState) {
      // Turn ON: Wake device
      this.currentState = 'transitioning_on';
      await this.platform.apiClient.wakeDevice(this.device.mac_address);
      await this.waitForOnline(); // Polls every 5s until online or timeout
    } else {
      // Turn OFF: Sleep or shutdown (configurable)
      this.currentState = 'transitioning_off';
      const offAction = this.platform.config.offAction || 'sleep';

      if (offAction === 'shutdown') {
        await this.platform.apiClient.shutdownDevice(this.device.id);
      } else {
        await this.platform.apiClient.sleepDevice(this.device.id);
      }
    }
  }

  startPolling() {
    this.updatePolling();
  }

  updatePolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    let interval: number;
    switch (this.currentState) {
      case 'transitioning_on': interval = POLLING_INTERVALS.TRANSITIONING_ON; break;
      case 'transitioning_off': interval = POLLING_INTERVALS.TRANSITIONING_OFF; break;
      case 'on': interval = POLLING_INTERVALS.STABLE_ONLINE; break;
      case 'off': interval = POLLING_INTERVALS.STABLE_OFFLINE; break;
    }

    this.pollingInterval = setInterval(() => this.pollStatus(), interval);
  }

  async pollStatus() {
    const status = await this.platform.apiClient.checkStatus(this.device.ip_address);
    const isOnline = status.online;

    // Update HomeKit state
    this.service.updateCharacteristic(
      this.platform.api.hap.Characteristic.On,
      isOnline
    );

    // Update polling strategy
    if (isOnline && this.currentState !== 'on') {
      this.currentState = 'on';
      this.updatePolling();
    } else if (!isOnline && this.currentState !== 'off') {
      this.currentState = 'off';
      this.updatePolling();
    }
  }
}
```

**Effort**: 4 hours

---

### 2.6 Configuration Schema

**File**: `config.schema.json` (for Homebridge UI)

```json
{
  "pluginAlias": "PcRemoteWake",
  "pluginType": "platform",
  "singular": true,
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "title": "Name",
        "type": "string",
        "default": "PC Remote Wake",
        "required": true
      },
      "webappUrl": {
        "title": "Webapp URL",
        "type": "string",
        "placeholder": "http://100.66.154.21:3000",
        "required": true
      },
      "apiKey": {
        "title": "API Key",
        "type": "string",
        "placeholder": "Generate from webapp dashboard",
        "required": true
      },
      "offAction": {
        "title": "Off Action",
        "type": "string",
        "default": "sleep",
        "oneOf": [
          { "title": "Sleep", "enum": ["sleep"] },
          { "title": "Shutdown", "enum": ["shutdown"] }
        ],
        "required": false
      },
      "pollingInterval": {
        "title": "Polling Interval (seconds)",
        "type": "integer",
        "default": 60,
        "minimum": 15,
        "maximum": 300,
        "required": false
      },
      "wakeTimeout": {
        "title": "Wake Timeout (seconds)",
        "type": "integer",
        "default": 120,
        "minimum": 30,
        "maximum": 300,
        "required": false
      },
      "debug": {
        "title": "Debug Mode",
        "type": "boolean",
        "default": false,
        "required": false
      }
    }
  }
}
```

**Effort**: 1 hour

---

### 2.7 Build & Installation

```bash
# Build TypeScript
npm run build

# Link for local testing
npm link

# Install in Homebridge
cd ~/.homebridge
npm link homebridge-pc-remote-wake

# Restart Homebridge
sudo systemctl restart homebridge
```

**Homebridge config.json**:
```json
{
  "platforms": [
    {
      "platform": "PcRemoteWake",
      "name": "PC Remote Wake",
      "webappUrl": "http://100.66.154.21:3000",
      "apiKey": "YOUR_API_KEY_FROM_WEBAPP",
      "offAction": "sleep",
      "pollingInterval": 60,
      "wakeTimeout": 120,
      "debug": false
    }
  ]
}
```

**Effort**: 1 hour

---

### 2.8 Testing & Validation

**Test Checklist**:
- [ ] Plugin loads without errors in Homebridge log
- [ ] Devices appear in Apple Home app
- [ ] "Turn On" wakes PC successfully (WOL packet sent, PC boots)
- [ ] "Turn Off" triggers sleep/shutdown command (SSH executed)
- [ ] Status polling updates HomeKit state correctly
- [ ] Adaptive polling transitions work (5s → 60s → 300s)
- [ ] Error handling works (offline PC, invalid credentials)
- [ ] Device discovery picks up new PCs added to webapp

**Testing commands**:
```bash
# Watch Homebridge logs
sudo journalctl -u homebridge -f

# Test API key manually
curl -H "Authorization: Bearer YOUR_KEY" \
     http://100.66.154.21:3000/api/devices

# Test wake (manual trigger)
curl -X POST -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"macAddress":"AA:BB:CC:DD:EE:FF"}' \
     http://100.66.154.21:3000/api/wake
```

**Effort**: 2 hours

---

**Phase 2 Deliverables**:
- ✅ Working Homebridge plugin (npm package)
- ✅ Device discovery from webapp
- ✅ HomeKit switch accessories for each PC
- ✅ Adaptive status polling (5s-300s intervals)
- ✅ Wake/sleep/shutdown commands
- ✅ Configuration UI schema
- ✅ End-to-end HomeKit testing

**Phase 2 Total**: 12-18 hours

---

## Phase 3: API Enhancements (Week 4)

**Objective**: Optimize webapp API for production reliability

**Effort**: 3-5 hours
**Priority**: 🟢 Medium (polish & optimization)

### 3.1 Batch Status Endpoint

**File**: `app/api/batch/status/route.ts` (NEW)

Check multiple devices in single request:

```typescript
// POST /api/batch/status
export async function POST(request: NextRequest) {
  const { deviceIds } = await request.json();

  const results = await Promise.all(
    deviceIds.map(async (id: number) => {
      const device = deviceDb.getById(id);
      if (!device?.ip_address) {
        return { id, online: false, rdpReady: false };
      }

      const status = await checkDeviceStatus(device.ip_address);
      return { id, ...status };
    })
  );

  return NextResponse.json({ devices: results });
}
```

**Benefit**: Reduces API calls by 80% (1 batch call vs. 5 individual calls for 5 PCs)

**Effort**: 1 hour

---

### 3.2 Health Check Endpoint

**File**: `app/api/health/route.ts` (NEW)

```typescript
// GET /api/health
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}
```

**Usage**: Homebridge plugin can check webapp availability before attempting operations

**Effort**: 0.5 hours

---

### 3.3 Error Response Standardization

**Goal**: All API errors return consistent JSON (no HTML redirects)

Update all API routes:
```typescript
// Before: return NextResponse.redirect(...) → HTML response
// After: return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

**Files to update**:
- `app/api/devices/route.ts`
- `app/api/wake/route.ts`
- `app/api/status/route.ts`
- `app/api/shutdown/route.ts`
- `app/api/sleep/route.ts`

**Effort**: 1 hour

---

### 3.4 Request Logging

**File**: `middleware.ts`

Add structured logging:
```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  method: request.method,
  path: pathname,
  auth: token ? 'cookie' : (authHeader ? 'bearer' : 'none'),
  ip: request.ip
}));
```

**Benefit**: Easier debugging and security auditing

**Effort**: 0.5 hours

---

### 3.5 Rate Limiting (Optional)

**Library**: `express-rate-limit` or custom implementation

```typescript
// Simple in-memory rate limiter
const requestCounts = new Map<string, number>();

function checkRateLimit(ip: string): boolean {
  const count = requestCounts.get(ip) || 0;
  if (count > 100) return false; // Max 100 req/min per IP

  requestCounts.set(ip, count + 1);
  setTimeout(() => requestCounts.delete(ip), 60000); // Reset after 1 min

  return true;
}
```

**Effort**: 1 hour (if needed)

---

**Phase 3 Deliverables**:
- ✅ Batch status endpoint (efficiency)
- ✅ Health check endpoint (monitoring)
- ✅ Standardized error responses
- ✅ Request logging
- ✅ Optional rate limiting

**Phase 3 Total**: 3-5 hours

---

## Phase 4: Remote Desktop Integration (Optional - Week 5-6)

**Objective**: Add RDP file generation for remote desktop access

**Effort**: 8-13 hours
**Priority**: 🔵 Low (optional enhancement)

See full design in `remote-desktop-integration-design.md` (Option 4: Simple RDP Link)

### 4.1 RDP File Generation

**File**: `app/api/rdp/[deviceId]/route.ts` (NEW)

```typescript
// GET /api/rdp/[deviceId]
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const device = deviceDb.getById(parseInt(params.deviceId));
  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const rdpContent = generateRdpFile(device);

  return new NextResponse(rdpContent, {
    headers: {
      'Content-Type': 'application/x-rdp',
      'Content-Disposition': `attachment; filename="${device.name}.rdp"`
    }
  });
}

function generateRdpFile(device: Device): string {
  return `
screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
full address:s:${device.ip_address}
audiomode:i:0
redirectprinters:i:0
redirectcomports:i:0
redirectsmartcards:i:0
redirectclipboard:i:1
redirectposdevices:i:0
drivestoredirect:s:
username:s:${device.ssh_username || ''}
alternate shell:s:
shell working directory:s:
authentication level:i:0
prompt for credentials:i:1
negotiate security layer:i:1
`.trim();
}
```

**Effort**: 2 hours

---

### 4.2 Dashboard UI Enhancement

Add "Remote Desktop" button next to each device:

```tsx
<button onClick={() => downloadRdp(device.id)}>
  📺 Remote Desktop
</button>

async function downloadRdp(deviceId: number) {
  const response = await fetch(`/api/rdp/${deviceId}`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${device.name}.rdp`;
  a.click();
}
```

**Effort**: 1 hour

---

### 4.3 Quick Connect Feature

**File**: `app/api/rdp/quick-connect/route.ts` (NEW)

```typescript
// POST /api/rdp/quick-connect
export async function POST(request: NextRequest) {
  const { deviceId, protocol } = await request.json();
  const device = deviceDb.getById(deviceId);

  let url: string;
  switch (protocol) {
    case 'rdp':
      url = `rdp://full%20address=s:${device.ip_address}`;
      break;
    case 'vnc':
      url = `vnc://${device.ip_address}:5900`;
      break;
    default:
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
  }

  return NextResponse.json({ url });
}
```

**Usage**: Click opens RDP client directly (if registered URL handler exists)

**Effort**: 1.5 hours

---

### 4.4 Connection History

Track successful connections:

```typescript
// New table: connection_logs
CREATE TABLE connection_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  protocol TEXT NOT NULL, -- 'rdp' or 'vnc'
  connected_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Effort**: 2 hours

---

### 4.5 Testing

**Test scenarios**:
- [ ] Download .rdp file from dashboard
- [ ] Open .rdp file with Microsoft Remote Desktop
- [ ] Verify connection to PC (requires RDP enabled on Windows)
- [ ] Test with multiple devices
- [ ] Test on different clients (Windows, Mac, iOS)

**Effort**: 1.5 hours

---

**Phase 4 Deliverables** (Optional):
- ✅ RDP file generation endpoint
- ✅ Download .rdp button in UI
- ✅ Quick connect feature
- ✅ Connection history tracking
- ✅ Cross-platform testing

**Phase 4 Total**: 8-13 hours (optional)

---

## Summary Timeline

| Phase | Description | Effort | Week |
|-------|-------------|--------|------|
| **Phase 1** | API Authentication Layer | 6-9 hours | Week 1 |
| **Phase 2** | Homebridge Plugin Development | 12-18 hours | Week 2-3 |
| **Phase 3** | API Enhancements | 3-5 hours | Week 4 |
| **Phase 4** | Remote Desktop (Optional) | 8-13 hours | Week 5-6 |
| **Total** | | **21-35 hours** | **4-6 weeks** |

---

## Testing Strategy

### Unit Testing
- Middleware authentication logic (bearer token + cookie fallback)
- API key hashing and verification
- RDP file generation

### Integration Testing
- End-to-end API authentication flow
- Device discovery and registration
- Status polling and state updates
- Power operations (wake/sleep/shutdown)

### User Acceptance Testing
- HomeKit accessibility and responsiveness
- Voice commands (Siri: "Turn on Gaming PC")
- Automation triggers (e.g., "Turn on Office PC when I arrive home")
- Multi-user scenarios (different HomeKit accounts)

---

## Security Considerations

**LAN-Only Deployment** (Current Architecture):
- ✅ API keys stored hashed (bcrypt)
- ✅ No HTTPS required (local network only)
- ✅ SSH credentials already in database (no new risk)
- ⚠️ No rate limiting (add in Phase 3 if needed)
- ⚠️ API key in Homebridge config file (plaintext) - acceptable for LAN

**If Exposing to Internet** (Future):
- 🔴 HTTPS required (change `secure: false` to `secure: true`)
- 🔴 Rate limiting mandatory
- 🔴 Consider rotating API keys
- 🔴 VPN recommended instead of direct exposure
- 🔴 2FA for webapp login

---

## Performance Expectations

**With 5 PC Devices**:
- API calls/day: ~4,000 (mixed state polling)
- Peak load: 12 calls/minute during power transitions
- Database load: Minimal (bcrypt + TCP probes)
- Memory usage: +20-30MB for Homebridge plugin

**Raspberry Pi 4 Resources**:
- Webapp: 150-200MB RAM
- Homebridge: 50-80MB RAM
- Plugin: +20-30MB RAM
- **Total**: ~250MB RAM (well within Pi capacity)

---

## Maintenance & Support

**Ongoing Tasks**:
- Monitor Homebridge logs for errors
- Rotate API keys quarterly (best practice)
- Update plugin when webapp API changes
- Test after OS updates (Raspberry Pi, Windows)

**Troubleshooting**:
- Check Homebridge logs: `sudo journalctl -u homebridge -f`
- Verify API key: `curl -H "Authorization: Bearer KEY" http://IP:PORT/api/health`
- Test WOL: Ensure BIOS WOL enabled, Fast Startup disabled
- Test SSH: Verify OpenSSH server running on Windows

---

## Future Enhancements

**Beyond Initial Scope**:
1. **Webhooks**: Push notifications instead of polling (reduces API calls by 90%)
2. **GraphQL API**: More efficient data fetching
3. **Multi-tenant**: Support multiple users with isolated device lists
4. **Mobile App**: Native iOS/Android app with push notifications
5. **Advanced Remote Desktop**: Apache Guacamole integration (browser-based)
6. **Monitoring Dashboard**: Historical uptime, connection stats, charts
7. **Automation Rules**: Custom schedules (e.g., wake PC at 8am on weekdays)

---

## References

**Design Documents**:
- `homebridge-architecture-design.md` - System architecture and authentication strategy
- `homebridge-plugin-specification.md` - Detailed plugin implementation guide
- `remote-desktop-integration-design.md` - Remote desktop options analysis

**External Resources**:
- [Homebridge Plugin Development](https://developers.homebridge.io/)
- [HomeKit Accessory Protocol](https://developer.apple.com/homekit/)
- [Wake-on-LAN Protocol](https://en.wikipedia.org/wiki/Wake-on-LAN)
- [Apple Remote Desktop Protocol](https://support.apple.com/guide/remote-desktop/)

---

## Conclusion

This roadmap provides a comprehensive, phased approach to integrating your PC Remote Wake webapp with Homebridge. The design prioritizes:

✅ **Simplicity**: Start with MVP (Phases 1-2), add enhancements later
✅ **Reliability**: Adaptive polling, error handling, graceful degradation
✅ **Security**: API key authentication, bcrypt hashing, audit logging
✅ **Performance**: Batch endpoints, caching, optimized polling intervals
✅ **Maintainability**: Clear code structure, TypeScript, comprehensive testing

**Recommended Start**: Complete Phase 1 (authentication) and Phase 2 (plugin MVP) first, then evaluate user feedback before investing in Phases 3-4.

**Questions?** Refer to the detailed design documents for technical specifications and code examples.
