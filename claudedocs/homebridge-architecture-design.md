# Homebridge Integration Architecture Design

**Project**: PC Remote Wake - Homebridge Plugin Integration
**Author**: System Architect Agent
**Date**: 2025-10-14
**Status**: Architecture Design Phase

---

## Executive Summary

This document outlines the core architecture for integrating PC Remote Wake webapp with Homebridge, enabling HomeKit control of Windows 11 PCs via Siri and the Home app. The design addresses authentication challenges (JWT cookie-based vs. Homebridge's programmatic access), state synchronization, and HomeKit accessory mapping.

**Key Architectural Decisions**:
- 🎯 **API Key Authentication**: Introduce bearer token system for Homebridge (parallel to existing JWT cookies)
- 🎯 **Switch Accessory Pattern**: Map PC devices to HomeKit Switch service with power state characteristic
- 🎯 **Adaptive Polling**: Intelligent status polling with exponential backoff and state-change detection
- 🎯 **Dual Authentication Layer**: Preserve cookie-based auth for webapp, add API key for programmatic access

---

## 1. System Architecture

### 1.1 Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Home App / Siri                             │
│                    (HomeKit Control Interface)                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HomeKit Accessory Protocol (HAP)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Homebridge (Node.js)                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │       homebridge-pc-remote-wake Plugin                        │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │  │
│  │  │   Platform   │  │   Accessory  │  │Status Poller │       │  │
│  │  │  Controller  │─▶│   Manager    │◀─│   Service    │       │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │  │
│  │         │                  │                  │               │  │
│  │         └──────────────────┴──────────────────┘               │  │
│  │                            │                                   │  │
│  │                    API Key Auth                               │  │
│  └────────────────────────────┼───────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ HTTPS/HTTP REST API
                                  │ (Authorization: Bearer <api-key>)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│            PC Remote Wake Webapp (Next.js 15)                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Enhanced Middleware                         │  │
│  │  ┌────────────────────┐    ┌────────────────────┐            │  │
│  │  │  Cookie Auth Path  │    │  API Key Auth Path │            │  │
│  │  │  (Browser/Web UI)  │    │  (Homebridge/API)  │            │  │
│  │  └────────────────────┘    └────────────────────┘            │  │
│  └─────────────────┬───────────────────┬───────────────────────────┘  │
│                    │                   │                              │
│  ┌─────────────────▼───────────────────▼───────────────────────────┐  │
│  │                      API Route Handlers                         │  │
│  │                                                                  │  │
│  │  GET    /api/devices              (List all devices)           │  │
│  │  POST   /api/wake                 (Send WOL magic packet)      │  │
│  │  POST   /api/status               (Check device status)        │  │
│  │  POST   /api/shutdown             (SSH shutdown command)       │  │
│  │  POST   /api/sleep                (SSH sleep command)          │  │
│  │  POST   /api/keys                 (Create/manage API keys)     │  │
│  │  GET    /api/keys                 (List API keys)              │  │
│  │  DELETE /api/keys/:id             (Revoke API key)             │  │
│  └─────────────────┬───────────────────────────────────────────────┘  │
│                    │                                                  │
│  ┌─────────────────▼───────────────────────────────────────────────┐  │
│  │              Database Layer (SQLite + WAL)                      │  │
│  │                                                                  │  │
│  │  - devices (id, name, mac, ip, ssh_creds)                       │  │
│  │  - users (id, username, password_hash)                          │  │
│  │  - api_keys (id, key_hash, name, user_id, last_used, created)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ WOL Magic Packet (UDP)
                                  │ SSH Commands (port 22)
                                  │ Status Check (TCP: 445, 3389)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Target Windows 11 PCs                             │
│  (OpenSSH Server, WOL-enabled NICs, RDP/SMB ports)                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Patterns

#### Startup Flow
```
1. Homebridge starts → Plugin initializes
2. Plugin reads config.json (API key, webapp URL)
3. GET /api/devices (with API key) → Retrieve device list
4. For each device → Create HomeKit Switch accessory
5. Register accessories with Homebridge/HAP
6. Start status polling service
```

#### Power On Flow (User says "Turn on Gaming PC")
```
1. HomeKit → Homebridge → Plugin.setPowerState(true)
2. Plugin → POST /api/wake { macAddress } (with API key)
3. Webapp → Send WOL magic packet (UDP broadcast)
4. Plugin → Update cached state to "turning on"
5. Plugin → Trigger immediate status check
6. POST /api/status { ipAddress } → Check ports 445/3389
7. If online → Update HomeKit state to ON
8. If offline → Continue polling with backoff
```

#### Power Off Flow (User says "Turn off Gaming PC")
```
1. HomeKit → Homebridge → Plugin.setPowerState(false)
2. Plugin → Verify device has SSH credentials
3. If no SSH → Return error, state unchanged
4. Plugin → POST /api/shutdown { deviceId } (with API key)
5. Webapp → SSH connect → Execute shutdown command
6. Plugin → Update cached state to "shutting down"
7. Plugin → Verify power off via status polling
8. POST /api/status → Confirm offline
9. Update HomeKit state to OFF
```

#### Status Polling Flow
```
1. Polling timer fires (interval varies by state)
2. For each device → POST /api/status { ipAddress }
3. Compare result with cached state
4. If state changed → Update HomeKit characteristic
5. If consecutive errors → Exponential backoff
6. If state stable → Reduce polling frequency
```

---

## 2. Authentication Strategy

### 2.1 Current State Analysis

🤔 **Problem Identification**:
- Existing middleware expects JWT in HTTP-only cookies (browser-centric)
- Homebridge plugin is programmatic client (cannot handle cookies/redirects)
- All protected routes redirect to `/login` on auth failure (breaks API access)
- No mechanism for long-lived, revocable API credentials

### 2.2 API Key Authentication Design

🎯 **Recommended Solution**: Dual authentication layer with bearer token support

#### Architecture Components

**Database Schema Addition**:
```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,           -- e.g., "Homebridge Production"
  user_id INTEGER NOT NULL,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,          -- Optional expiration
  revoked BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

**API Key Format**:
```
Format: pc-wake-<version>-<32-byte-base64-random>
Example: pc-wake-v1-8f4d7b2a9c1e6h3k5m7n9p2q4r6s8t0u
Length: ~50 characters
```

**Key Generation Logic**:
```typescript
// lib/api-key.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface ApiKey {
  id: number;
  key_hash: string;
  name: string;
  user_id: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  revoked: boolean;
}

export async function generateApiKey(): Promise<string> {
  const randomBytes = crypto.randomBytes(32);
  const key = `pc-wake-v1-${randomBytes.toString('base64url')}`;
  return key;
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
```

#### Middleware Enhancement

**Enhanced Authentication Flow**:
```typescript
// middleware.ts (enhanced version)
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 🎯 DECISION POINT: Check authentication method
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    // API Key authentication path
    const apiKey = authHeader.substring(7);
    const keyData = await verifyApiKey(apiKey);

    if (keyData) {
      // Update last_used_at
      await apiKeyDb.updateLastUsed(keyData.id);

      // Add key data to request context for logging
      const response = NextResponse.next();
      response.headers.set('X-Auth-Method', 'api-key');
      response.headers.set('X-Auth-User-Id', keyData.user_id.toString());
      return response;
    }

    // Invalid API key
    return NextResponse.json(
      { error: 'Invalid or revoked API key' },
      { status: 401 }
    );
  }

  // Cookie-based authentication path (existing logic)
  const token = request.cookies.get('session')?.value;

  if (!token) {
    // Differentiate API vs. browser requests
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');

    if (acceptsHtml) {
      return NextResponse.redirect(new URL('/login', request.url));
    } else {
      return NextResponse.json(
        { error: 'Authentication required. Use Bearer token or login.' },
        { status: 401 }
      );
    }
  }

  const session = await verifySession(token);

  if (!session) {
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    const response = acceptsHtml
      ? NextResponse.redirect(new URL('/login', request.url))
      : NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    response.cookies.delete('session');
    return response;
  }

  return NextResponse.next();
}
```

#### API Key Management Endpoints

**POST /api/keys** - Create new API key:
```typescript
// app/api/keys/route.ts
export async function POST(request: NextRequest) {
  const session = await getSession(); // Requires cookie auth
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, expiresInDays } = await request.json();

  // Generate key and hash
  const key = await generateApiKey();
  const keyHash = await hashApiKey(key);

  // Calculate expiration
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Store in database
  const apiKey = apiKeyDb.create({
    key_hash: keyHash,
    name,
    user_id: session.userId,
    expires_at: expiresAt?.toISOString(),
  });

  // Return plaintext key ONCE (never stored)
  return NextResponse.json({
    success: true,
    key,  // ⚠️ Only returned on creation
    id: apiKey.id,
    name: apiKey.name,
    created_at: apiKey.created_at,
    expires_at: apiKey.expires_at,
  });
}
```

**GET /api/keys** - List API keys:
```typescript
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = apiKeyDb.getByUserId(session.userId);

  // Return metadata only (no key values)
  return NextResponse.json({
    keys: keys.map(k => ({
      id: k.id,
      name: k.name,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      expires_at: k.expires_at,
      revoked: k.revoked,
    })),
  });
}
```

**DELETE /api/keys/[id]** - Revoke API key:
```typescript
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keyId = parseInt(params.id);
  const key = apiKeyDb.getById(keyId);

  if (!key || key.user_id !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  apiKeyDb.revoke(keyId);

  return NextResponse.json({ success: true });
}
```

### 2.3 Security Considerations

**API Key Security**:
- ✅ Keys hashed with bcrypt (same as passwords)
- ✅ Plaintext key returned only once at creation
- ✅ Rate limiting per key (implement in middleware)
- ✅ Automatic expiration support
- ✅ Last used timestamp for auditing
- ✅ Manual revocation capability
- ⚠️ Keys stored in Homebridge config.json (file permissions critical)

**Deployment Recommendations**:
```json
// config.json file permissions
chmod 600 ~/.homebridge/config.json
chown homebridge:homebridge ~/.homebridge/config.json

// Environment variable alternative
export PC_WAKE_API_KEY="pc-wake-v1-..."
```

---

## 3. HomeKit Accessory Mapping

### 3.1 Accessory Type Selection

🤔 **Analysis**: HomeKit service types for PC representation

**Option A: Switch Service** ✅ RECOMMENDED
- **Pros**: Simple binary state (on/off), natural user experience ("Turn on PC")
- **Cons**: No shutdown capability without SSH credentials
- **HomeKit Category**: Switch (category 8)

**Option B: Outlet Service**
- **Pros**: Similar to Switch, "programmable" feel
- **Cons**: Semantically incorrect (not a power outlet)
- **Decision**: Rejected - misleading metaphor

**Option C: Custom Service**
- **Pros**: Full control over characteristics
- **Cons**: Poor Home app UI, not Siri-friendly, complex implementation
- **Decision**: Rejected - unnecessary complexity

🎯 **SELECTED APPROACH**: Switch Service with enhanced characteristics

### 3.2 HomeKit Characteristics Mapping

**Primary Characteristic**:
```typescript
{
  service: Service.Switch,
  characteristic: Characteristic.On,

  // PC Power State Mapping
  get: async () => {
    const status = await checkDeviceStatus(device.ip_address);
    return status.online;  // true = ON, false = OFF
  },

  set: async (value: boolean) => {
    if (value === true) {
      // Power ON → Send WOL packet
      await wakeDevice(device.mac_address);
    } else {
      // Power OFF → Send SSH shutdown
      if (!device.ssh_username) {
        throw new Error('SSH credentials required for shutdown');
      }
      await shutdownDevice(device.id);
    }
  }
}
```

**Optional Characteristics** (for enhanced functionality):

1. **StatusActive** - Indicates if device is responsive:
   ```typescript
   characteristic: Characteristic.StatusActive,
   get: async () => {
     const status = await checkDeviceStatus(device.ip_address);
     return status.online && status.rdpReady;  // Both online AND RDP ready
   }
   ```

2. **StatusFault** - Indicates network/communication errors:
   ```typescript
   characteristic: Characteristic.StatusFault,
   get: () => {
     return this.lastStatusCheck.error ? 1 : 0;  // 1 = fault, 0 = no fault
   }
   ```

### 3.3 Accessory Configuration

**Homebridge config.json Schema**:
```json
{
  "platforms": [
    {
      "platform": "PCRemoteWake",
      "name": "PC Remote Wake",
      "webappUrl": "http://raspberrypi.local:3000",
      "apiKey": "pc-wake-v1-...",
      "polling": {
        "enabled": true,
        "intervalSeconds": 30,
        "onlineIntervalSeconds": 60,
        "offlineIntervalSeconds": 300
      },
      "devices": [
        {
          "name": "Gaming PC",
          "enableShutdown": true,
          "customPollingInterval": 15
        },
        {
          "name": "Work PC",
          "enableShutdown": false
        }
      ]
    }
  ]
}
```

**Configuration Options**:
- `webappUrl`: Base URL of PC Remote Wake webapp
- `apiKey`: Generated API key from webapp
- `polling.enabled`: Enable/disable automatic status polling
- `polling.intervalSeconds`: Default polling interval
- `polling.onlineIntervalSeconds`: Polling interval when device is online (reduce frequency)
- `polling.offlineIntervalSeconds`: Polling interval when device is offline (longer delays)
- `devices[].name`: Override device name from webapp (optional)
- `devices[].enableShutdown`: Allow/disallow shutdown via HomeKit (safety feature)
- `devices[].customPollingInterval`: Per-device polling override

### 3.4 Device Discovery

**Dynamic Device Synchronization**:
```typescript
class PCRemoteWakePlatform {
  async discoverDevices() {
    // Fetch devices from webapp
    const response = await fetch(`${this.webappUrl}/api/devices`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    const { devices } = await response.json();

    // Match with existing accessories
    const existingUUIDs = this.accessories.map(a => a.UUID);
    const currentUUIDs = devices.map(d => this.generateUUID(d.mac_address));

    // Remove deleted devices
    const toRemove = existingUUIDs.filter(uuid => !currentUUIDs.includes(uuid));
    toRemove.forEach(uuid => this.removeAccessory(uuid));

    // Add new devices
    devices.forEach(device => {
      const uuid = this.generateUUID(device.mac_address);
      if (!existingUUIDs.includes(uuid)) {
        this.addAccessory(device);
      } else {
        this.updateAccessory(device);
      }
    });
  }

  generateUUID(macAddress: string): string {
    // Generate deterministic UUID from MAC address
    return this.api.hap.uuid.generate(`pc-wake-${macAddress}`);
  }
}
```

---

## 4. State Synchronization Strategy

### 4.1 Polling Architecture

⚡ **Performance Goal**: Minimize API calls while maintaining responsive state updates

#### Adaptive Polling Algorithm

**State-Based Intervals**:
```typescript
enum DeviceState {
  ONLINE_STABLE = 'online_stable',      // 60s interval
  OFFLINE_STABLE = 'offline_stable',    // 300s interval
  TRANSITIONING_ON = 'transitioning_on',   // 5s interval
  TRANSITIONING_OFF = 'transitioning_off', // 10s interval
  ERROR = 'error'                       // 120s interval
}

class AdaptivePoller {
  private state: DeviceState = DeviceState.OFFLINE_STABLE;
  private consecutiveStableChecks = 0;
  private errorCount = 0;

  getNextInterval(): number {
    switch (this.state) {
      case DeviceState.TRANSITIONING_ON:
        return 5000;   // 5s - rapid polling during boot

      case DeviceState.TRANSITIONING_OFF:
        return 10000;  // 10s - moderate polling during shutdown

      case DeviceState.ONLINE_STABLE:
        return 60000;  // 60s - slow polling when stable

      case DeviceState.OFFLINE_STABLE:
        return 300000; // 300s - very slow polling when off

      case DeviceState.ERROR:
        return Math.min(120000 * Math.pow(2, this.errorCount), 600000);
        // Exponential backoff: 2m → 4m → 8m → 10m (max)
    }
  }

  async checkStatus(device: Device): Promise<StatusResult> {
    try {
      const result = await this.apiClient.checkStatus(device.ip_address);
      this.errorCount = 0;  // Reset error counter on success

      // State transition logic
      this.updateState(result);

      return result;
    } catch (error) {
      this.errorCount++;
      this.state = DeviceState.ERROR;
      throw error;
    }
  }

  updateState(result: StatusResult) {
    const wasOnline = this.state === DeviceState.ONLINE_STABLE ||
                      this.state === DeviceState.TRANSITIONING_ON;
    const isOnline = result.online;

    if (isOnline && !wasOnline) {
      // Transition: OFF → ON
      this.state = DeviceState.TRANSITIONING_ON;
      this.consecutiveStableChecks = 0;
    } else if (!isOnline && wasOnline) {
      // Transition: ON → OFF
      this.state = DeviceState.TRANSITIONING_OFF;
      this.consecutiveStableChecks = 0;
    } else {
      // Stable state
      this.consecutiveStableChecks++;

      // Require 3 consecutive stable checks before declaring stable
      if (this.consecutiveStableChecks >= 3) {
        this.state = isOnline
          ? DeviceState.ONLINE_STABLE
          : DeviceState.OFFLINE_STABLE;
      }
    }
  }
}
```

### 4.2 Event-Driven Updates

**Immediate Status Checks**:
```typescript
class PCAccessory {
  async setPowerState(value: boolean) {
    if (value) {
      // Wake request
      await this.apiClient.wake(this.device.mac_address);

      // Immediately switch to rapid polling
      this.poller.setState(DeviceState.TRANSITIONING_ON);
      this.poller.triggerImmediateCheck();
    } else {
      // Shutdown request
      await this.apiClient.shutdown(this.device.id);

      // Moderate polling for shutdown verification
      this.poller.setState(DeviceState.TRANSITIONING_OFF);
      this.poller.triggerImmediateCheck();
    }
  }
}
```

### 4.3 Caching Strategy

**In-Memory State Cache**:
```typescript
interface CachedState {
  online: boolean;
  rdpReady: boolean;
  lastChecked: Date;
  lastChanged: Date;
  errorCount: number;
}

class StatusCache {
  private cache = new Map<string, CachedState>();
  private readonly MAX_AGE_MS = 30000; // 30s cache

  get(deviceId: string): CachedState | null {
    const cached = this.cache.get(deviceId);
    if (!cached) return null;

    const age = Date.now() - cached.lastChecked.getTime();
    if (age > this.MAX_AGE_MS) return null;

    return cached;
  }

  set(deviceId: string, state: CachedState) {
    this.cache.set(deviceId, state);
  }

  invalidate(deviceId: string) {
    this.cache.delete(deviceId);
  }
}
```

### 4.4 Error Handling & Resilience

**Network Failure Scenarios**:

1. **Webapp Unreachable**:
   ```typescript
   catch (error: FetchError) {
     if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
       this.log.error('Webapp unreachable:', error.message);
       // Don't update HomeKit state - maintain last known state
       // Exponential backoff for retry
       this.poller.incrementErrorCount();
       return;
     }
   }
   ```

2. **API Key Invalid**:
   ```typescript
   if (response.status === 401) {
     this.log.error('API key invalid or revoked');
     // Stop polling, show error in Homebridge logs
     this.poller.stop();
     this.accessories.forEach(acc => {
       acc.setStatusFault(true);
     });
   }
   ```

3. **Device IP Address Missing**:
   ```typescript
   if (!device.ip_address) {
     this.log.warn(`Device ${device.name} has no IP address - cannot check status`);
     // Show as "unreachable" in HomeKit
     accessory.updateCharacteristic(Characteristic.StatusActive, false);
     accessory.updateCharacteristic(Characteristic.StatusFault, 1);
   }
   ```

**Retry Logic**:
```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 5000, // 5s timeout
      });

      if (response.ok) return response;

      // Don't retry 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Retry 5xx errors
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError;
}
```

---

## 5. Implementation Requirements

### 5.1 Webapp Modifications

**Required Changes**:

1. **Database Schema** (`lib/db.ts`):
   - Add `api_keys` table
   - Implement `apiKeyDb` namespace with CRUD operations
   - Add indexes for performance

2. **Authentication Module** (`lib/auth.ts`):
   - Add API key generation functions
   - Add API key verification functions
   - Update last_used_at timestamp logic

3. **Middleware** (`middleware.ts`):
   - Add `Authorization: Bearer` header detection
   - Add API key verification path (parallel to cookie auth)
   - Differentiate HTML vs. JSON error responses

4. **API Routes**:
   - `POST /api/keys` - Create API key (requires cookie auth)
   - `GET /api/keys` - List user's API keys (requires cookie auth)
   - `DELETE /api/keys/[id]` - Revoke API key (requires cookie auth)

5. **UI Components**:
   - API key management page in settings
   - Key creation modal with one-time display
   - Key list with last used timestamps
   - Revoke confirmation dialog

### 5.2 Homebridge Plugin Architecture

**Plugin Structure**:
```
homebridge-pc-remote-wake/
├── src/
│   ├── platform.ts              # Platform controller (main entry)
│   ├── accessory.ts             # PC accessory implementation
│   ├── api-client.ts            # Webapp API client
│   ├── status-poller.ts         # Adaptive polling service
│   ├── cache.ts                 # Status cache manager
│   └── types.ts                 # TypeScript interfaces
├── config.schema.json           # Homebridge config UI schema
├── package.json
└── README.md
```

**Core Plugin Classes**:

```typescript
// platform.ts
export class PCRemoteWakePlatform implements DynamicPlatformPlugin {
  private readonly accessories: Map<string, PCAccessory> = new Map();
  private apiClient: WebappAPIClient;
  private poller: StatusPollerService;

  constructor(
    private readonly log: Logger,
    private readonly config: PlatformConfig,
    private readonly api: API
  ) {
    this.apiClient = new WebappAPIClient(config.webappUrl, config.apiKey);
    this.poller = new StatusPollerService(this.apiClient, log);

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  async discoverDevices() { /* ... */ }
  configureAccessory(accessory: PlatformAccessory) { /* ... */ }
}

// accessory.ts
export class PCAccessory {
  private service: Service;

  constructor(
    private readonly platform: PCRemoteWakePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: Device
  ) {
    this.service = this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getPowerState.bind(this))
      .onSet(this.setPowerState.bind(this));
  }

  async getPowerState(): Promise<boolean> { /* ... */ }
  async setPowerState(value: boolean): Promise<void> { /* ... */ }
}

// api-client.ts
export class WebappAPIClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDevices(): Promise<Device[]> { /* ... */ }
  async wake(macAddress: string): Promise<void> { /* ... */ }
  async checkStatus(ipAddress: string): Promise<StatusResult> { /* ... */ }
  async shutdown(deviceId: number): Promise<void> { /* ... */ }
}
```

### 5.3 Configuration Management

**config.schema.json** (for Homebridge Config UI):
```json
{
  "pluginAlias": "PCRemoteWake",
  "pluginType": "platform",
  "singular": true,
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "title": "Platform Name",
        "type": "string",
        "default": "PC Remote Wake",
        "required": true
      },
      "webappUrl": {
        "title": "Webapp URL",
        "type": "string",
        "format": "uri",
        "placeholder": "http://raspberrypi.local:3000",
        "required": true
      },
      "apiKey": {
        "title": "API Key",
        "type": "string",
        "placeholder": "pc-wake-v1-...",
        "required": true
      },
      "polling": {
        "title": "Polling Settings",
        "type": "object",
        "properties": {
          "enabled": {
            "title": "Enable Status Polling",
            "type": "boolean",
            "default": true
          },
          "intervalSeconds": {
            "title": "Default Interval (seconds)",
            "type": "integer",
            "default": 30,
            "minimum": 5
          },
          "onlineIntervalSeconds": {
            "title": "Online Interval (seconds)",
            "type": "integer",
            "default": 60,
            "minimum": 10
          },
          "offlineIntervalSeconds": {
            "title": "Offline Interval (seconds)",
            "type": "integer",
            "default": 300,
            "minimum": 30
          }
        }
      }
    }
  }
}
```

---

## 6. Decision Summary & Trade-offs

### 6.1 Key Architectural Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **API Key Authentication** | Homebridge cannot handle cookies/redirects; need long-lived credentials | Additional complexity in webapp; key management UI required |
| **Switch Service Type** | Simple, Siri-friendly, natural user mental model | Cannot represent "sleep" state; binary only |
| **Adaptive Polling** | Balance responsiveness with API load; optimize for common cases | Complex state machine; requires tuning |
| **Dual Auth Paths** | Preserve existing webapp UX; add programmatic access | Two auth codepaths to maintain |
| **MAC Address UUID** | Deterministic accessory identification across restarts | Cannot change MAC address without losing HomeKit settings |
| **Bearer Token Header** | Standard REST API authentication pattern | Requires secure storage in Homebridge config |

### 6.2 Performance Characteristics

**Expected Load Profile** (per device):
- **Stable Online**: 1 API call per 60s = ~1,440 calls/day
- **Stable Offline**: 1 API call per 300s = ~288 calls/day
- **Transitioning**: Up to 12 rapid checks (5s interval) = burst load

**Total Load** (5 devices):
- **Worst Case**: ~8,640 API calls/day (all online)
- **Best Case**: ~1,440 API calls/day (all offline)
- **Typical**: ~4,000 API calls/day (mixed states)

**Database Impact**:
- API key verification: 4,000 bcrypt comparisons/day (~1 per request)
- Status checks: 4,000 TCP probes/day
- Minimal disk I/O (SQLite reads only)

### 6.3 Security Considerations

**Threat Model**:
- 🛡️ **Mitigated**: Unauthorized API access (API key + bcrypt)
- 🛡️ **Mitigated**: Key leakage (revocation support)
- 🛡️ **Mitigated**: Replay attacks (HTTPS recommended)
- ⚠️ **Residual**: Key stored in plaintext config file (file permissions critical)
- ⚠️ **Residual**: No rate limiting on API keys (recommend implementation)

**Recommendations**:
1. Enforce HTTPS in production (set `secure: true` in cookies)
2. Implement rate limiting per API key (e.g., 100 req/min)
3. Add audit logging for API key usage
4. Set file permissions on config.json: `chmod 600`
5. Support environment variable for API key (avoid config file)

### 6.4 Future Enhancements

**Phase 2 Possibilities**:
- WebSocket support for real-time state updates (eliminate polling)
- Sleep/hibernate support via custom HomeKit characteristic
- Device grouping (turn on/off multiple PCs simultaneously)
- Wake-on-LAN scheduling via HomeKit automations
- RDP connection status as separate "sensor" accessory
- Integration with Home app scenes (e.g., "Gaming Mode" → turn on PC + lights)

---

## 7. Implementation Roadmap

### Phase 1: Core Infrastructure (Webapp)
1. Database schema migration (api_keys table)
2. API key generation/verification functions
3. Enhanced middleware with dual auth paths
4. API key management endpoints
5. Unit tests for authentication logic

### Phase 2: Homebridge Plugin Foundation
1. Plugin scaffolding and NPM setup
2. API client implementation
3. Platform controller with device discovery
4. Basic accessory implementation (power on/off)
5. Config schema for Homebridge UI

### Phase 3: State Synchronization
1. Adaptive polling service
2. Status cache implementation
3. Error handling and retry logic
4. Exponential backoff for failures
5. HomeKit characteristic updates

### Phase 4: Polish & Testing
1. End-to-end testing with real devices
2. Performance optimization
3. Documentation and README
4. NPM package publishing
5. User feedback and iteration

---

## 8. Conclusion

This architecture provides a robust foundation for Homebridge integration with PC Remote Wake, addressing the core challenges of authentication, state synchronization, and HomeKit mapping. The dual authentication layer preserves existing webapp functionality while enabling programmatic access for Homebridge. The adaptive polling strategy balances responsiveness with API efficiency, and the Switch service type provides a natural, Siri-friendly user experience.

**Critical Success Factors**:
- ✅ Secure API key management with revocation support
- ✅ Reliable status polling with error resilience
- ✅ Seamless HomeKit integration with standard Switch service
- ✅ Clear separation between browser-based and programmatic authentication

**Next Steps**:
1. Review architecture with stakeholders
2. Implement Phase 1 (webapp auth enhancements)
3. Develop minimal viable plugin for testing
4. Iterate based on real-world performance

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Status**: Ready for Implementation Review
