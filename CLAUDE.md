# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PC Remote Wake is a Next.js 15 web application for remotely managing Windows 11 PCs using Wake-on-LAN (WOL). Designed to run on Raspberry Pi, it provides:
- Wake-on-LAN magic packet transmission
- Device status monitoring (Online/Offline/RDP Ready)
- Remote shutdown/sleep via SSH
- SQLite database for persistent device and user storage
- JWT-based authentication system

## Development Commands

### Local Development
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build production version with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint
```

### Testing
```bash
npm test             # Run Playwright E2E tests
npm run test:ui      # Run tests with Playwright UI
npm run test:headed  # Run tests in headed browser
npm run test:debug   # Run tests in debug mode
npm run test:report  # View last test report
```

Tests are located in `tests/e2e/` and run sequentially with a single worker for database consistency.

### Environment Setup
```bash
# Generate JWT secret
openssl rand -base64 32

# Create .env file with:
JWT_SECRET=<generated-secret>
METRICS_RETENTION_DAYS=365  # Optional: Default is 365 days (1 year)

# Background scheduler (optional)
ENABLE_BACKGROUND_METRICS=true  # Enable 24/7 background metrics collection
BACKGROUND_METRICS_INTERVAL=300000  # Collection interval in ms (5 minutes)
BACKGROUND_METRICS_CONCURRENT=3  # Max concurrent device collections
```

### Database Location
SQLite database is auto-created at `data/devices.db` on first run. Contains:
- `users` table (username, password_hash)
- `devices` table (name, mac_address, ip_address, ssh_username, ssh_password)
- `api_keys` table (key_hash, name, created_by, last_used_at)
- `system_metrics` table (device metrics: CPU, RAM, GPU, network, power consumption)
- `user_preferences` table (metrics polling interval, notification settings, power threshold)
- `collection_history` table (success/failure tracking, performance metrics)
- `notifications` table (power alerts, collection failures, device offline alerts)

## Architecture

### Framework & Stack
- **Framework**: Next.js 15 with App Router (React 19)
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via better-sqlite3 with WAL mode
- **Authentication**: Dual auth system - JWT cookies (web UI) + API keys (programmatic access)
- **Testing**: Playwright for E2E tests with sequential execution
- **Network**: wake_on_lan for WOL, node-ssh for remote commands, tcp-ping for status checks

### Key Directories
```
app/
├── api/              # API route handlers
│   ├── auth/        # Authentication endpoints (login, logout, session, init)
│   ├── devices/     # Device CRUD operations
│   ├── keys/        # API key management (create, list, delete)
│   ├── metrics/     # System metrics (collect, retrieve, cleanup, energy stats)
│   ├── notifications/ # Notification management (list, mark read, delete)
│   ├── preferences/ # User preferences (polling interval, notification settings)
│   ├── scheduler/   # Background scheduler control (start, stop, status)
│   ├── wake/        # Wake-on-LAN endpoint
│   ├── shutdown/    # SSH shutdown endpoint
│   ├── sleep/       # SSH sleep endpoint
│   ├── status/      # Device status checking (TCP ping)
│   └── discover-ip/ # ARP-based IP discovery
├── login/           # Login page
├── setup/           # First-time admin account creation
├── settings/        # API key management & notification preferences UI
└── page.tsx         # Main dashboard with metrics charts & notification bell

lib/
├── db.ts                    # Database layer (deviceDb, userDb, apiKeyDb, metricsDb, userPreferencesDb)
├── auth.ts                  # Auth utilities (JWT, bcrypt, API keys, session management)
├── metrics.ts               # System metrics collection via SSH + PowerShell
├── scheduler.ts             # Background scheduler for 24/7 metrics collection
├── notification-service.ts  # Notification system (power alerts, collection failures)
└── db-collection-history.ts # Collection history tracking and statistics

components/
├── NotificationBell.tsx     # Notification bell UI with dropdown panel
└── metrics/
    ├── MetricsPanel.tsx     # Metrics dashboard with smart polling
    └── MetricsChart.tsx     # Historical metrics visualization

tests/
├── e2e/             # Playwright E2E tests
├── fixtures/        # Test fixtures and helpers
└── mocks/           # Mock implementations

middleware.ts         # Dual auth: JWT cookies + API key Bearer tokens
```

### Core Components

#### Database Layer ([lib/db.ts](lib/db.ts))
- Lazy initialization pattern with singleton instance
- WAL mode enabled for better concurrency
- Automatic schema migrations (adds columns if missing)
- Three separate namespaces: `deviceDb`, `userDb`, and `apiKeyDb`
- Uses prepared statements for all queries
- Foreign key constraints enabled (api_keys → users)

#### Authentication ([lib/auth.ts](lib/auth.ts))
**Dual Authentication System**:
1. **JWT Cookie Auth** (Web UI):
   - JWT tokens with 7-day expiration
   - HTTP-only cookies with `sameSite: 'lax'`
   - `secure: false` (designed for local network, change for HTTPS)
   - Session data: `{ userId, username, exp }`

2. **API Key Auth** (Programmatic Access):
   - Bearer token format: `Authorization: Bearer pcw_xxx`
   - bcrypt-hashed keys stored in database
   - Per-key name and last_used tracking
   - Suitable for Homebridge, automation, external integrations

#### Middleware ([middleware.ts](middleware.ts))
- Protects all routes except `/login`, `/setup`, `/api/auth/*`
- **Dual Authentication Flow**:
  - API routes with `Authorization: Bearer` header → passed to route handler for API key validation
  - All other routes → JWT cookie verification
- Redirects to `/login` for invalid/missing JWT tokens
- Excludes static assets and images
- Individual API routes handle API key authentication via `verifyApiKey()`

#### API Routes

**Wake-on-LAN** ([app/api/wake/route.ts](app/api/wake/route.ts)):
- Validates MAC address format: `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`
- Sends UDP broadcast magic packet via `wake_on_lan` library
- No IP address required (broadcasts to subnet)

**Status Checking** ([app/api/status/route.ts](app/api/status/route.ts)):
- TCP ping to ports 445 (SMB) and 3389 (RDP)
- 2-second timeout per check
- Returns `{ online, rdpReady, ipAddress, checkedAt }`
- `online`: true if either port responds
- `rdpReady`: true if RDP port (3389) responds

**SSH Commands** ([app/api/shutdown/route.ts](app/api/shutdown/route.ts), [app/api/sleep/route.ts](app/api/sleep/route.ts)):
- Requires device with IP address and SSH credentials stored
- 10-second connection timeout
- Shutdown: `shutdown /s /t 0`
- Sleep: `rundll32.exe powrprof.dll,SetSuspendState 0,1,0`
- Automatically disposes SSH connection

**API Key Management** ([app/api/keys/route.ts](app/api/keys/route.ts)):
- `GET /api/keys` - List all API keys for current user (excludes key_hash)
- `POST /api/keys` - Generate new API key with custom name
- `DELETE /api/keys/[id]` - Revoke specific API key
- Returns plaintext key only once during creation (bcrypt-hashed storage)
- Keys prefixed with `pcw_` for easy identification

**System Metrics Collection** ([lib/metrics.ts](lib/metrics.ts)):
- Collects real-time system metrics via SSH + PowerShell commands
- `POST /api/metrics/collect` - Trigger metrics collection for device
- `GET /api/metrics/[deviceId]` - Retrieve metrics history (last 24h by default)
- `GET /api/metrics/[deviceId]/latest` - Get most recent metrics
- `GET /api/metrics/[deviceId]/energy` - Energy consumption stats
- `POST /api/metrics/cleanup` - Delete old metrics based on retention policy
  - Default retention: 365 days (configurable via `METRICS_RETENTION_DAYS` env var)
  - Supports query parameter: `?days=N` to override retention (min: 1, max: 3650 days)
  - Returns `{ deleted, cleanedAt, retentionDays }`

**Data Aggregation** ([lib/db.ts:metricsDb](lib/db.ts)):
- `getHourlyAggregates()` - Aggregate raw data into hourly averages for space efficiency
- `getDailyAggregates()` - Aggregate raw data into daily averages for long-term trends
- `getAdaptiveAggregates()` - Automatically selects resolution based on time range:
  - < 48 hours: Raw data (5-minute intervals)
  - 48 hours to 30 days: Hourly aggregates
  - > 30 days: Daily aggregates (with energy totals)

**Storage Estimates** (with 5-minute collection intervals):
- 1 month: ~8,640 data points (~500KB)
- 1 year: ~105,000 data points (~6MB)
- 5 years: ~525,000 data points (~30MB)
- Note: Data aggregation can reduce storage by 90% for old data while maintaining trends
- Metrics collected:
  - CPU usage (percentage)
  - RAM usage (used/total GB, percentage)
  - GPU usage, memory, power draw (NVIDIA via nvidia-smi)
  - Power consumption (system meter or estimated from TDP)
- Power measurement strategies:
  1. Total system power meter (most accurate)
  2. CPU + GPU sensor aggregation
  3. TDP-based estimation from utilization
- 5-second timeout per PowerShell command
- Base64-encoded commands for shell escape safety

### Authentication Flow

#### Web UI (JWT Cookie)
1. **First Launch**:
   - No users exist → redirect to `/setup`
   - Admin creates account → redirect to `/login`

2. **Login**:
   - POST `/api/auth/login` with username/password
   - Returns JWT token, sets HTTP-only cookie
   - Redirects to main dashboard

3. **Session Management**:
   - Middleware checks JWT on every protected route
   - 7-day token expiration
   - Cookie cleared on logout or invalid token

#### Programmatic Access (API Key)
1. **Key Creation**:
   - User generates API key via web UI: POST `/api/keys` with `{ name }`
   - Plaintext key returned once: `pcw_xxxxxxxxxxxxx`
   - bcrypt hash stored in database

2. **API Usage**:
   - Include header: `Authorization: Bearer pcw_xxxxxxxxxxxxx`
   - Middleware passes Bearer requests to route handlers
   - Routes call `verifyApiKey()` to validate and track usage
   - `last_used_at` timestamp updated on each use

3. **Key Management**:
   - List keys: GET `/api/keys` (shows name, created_at, last_used_at)
   - Revoke: DELETE `/api/keys/[id]`

### Device Management Flow

1. **Add Device**: POST `/api/devices` with `{ name, mac_address, ip_address?, ssh_username?, ssh_password? }`
2. **Wake Device**: POST `/api/wake` with `{ macAddress }`
3. **Check Status**: POST `/api/status` with `{ ipAddress }`
4. **Remote Commands**: POST `/api/shutdown` or `/api/sleep` with `{ deviceId }`
5. **Metrics Collection**: POST `/api/metrics/collect` with `{ deviceId }` (requires SSH credentials)
6. **View Metrics**: GET `/api/metrics/[deviceId]?hours=24` for historical data

### Important Implementation Details

- **MAC Address Validation**: Regex `/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/`
- **Database WAL Mode**: Better concurrency for multiple requests
- **5-second busy timeout**: Prevents database locks
- **Unique Constraints**: `mac_address` in devices table, `username` in users table
- **Auto-discovery**: Uses ARP table lookup for IP from MAC address
- **Port Checking**: Uses tcp-ping library with Promise wrapper
- **SSH Disposal**: Always dispose SSH connections in finally blocks

## Common Patterns

### Database Operations
```typescript
// Always use prepared statements
const device = deviceDb.getById(id);
const allDevices = deviceDb.getAll();
deviceDb.create({ name, mac_address, ip_address });
```

### Authentication Checks
```typescript
// JWT Cookie Auth (Web UI routes)
import { getSession } from '@/lib/auth';
const session = await getSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// API Key Auth (Programmatic access)
import { verifyApiKey } from '@/lib/auth';
const apiKeyAuth = await verifyApiKey(request);
if (!apiKeyAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// Dual Auth Support (accept either)
const session = await getSession();
const apiKeyAuth = !session ? await verifyApiKey(request) : null;
if (!session && !apiKeyAuth) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Error Handling
```typescript
// Consistent error response format
return NextResponse.json(
  { error: 'Message', details: errorDetails },
  { status: 500 }
);
```

## Security Considerations

- JWT_SECRET must be set in production (use `openssl rand -base64 32`)
- API keys are bcrypt-hashed (10 rounds) before storage
- SSH credentials stored in plaintext in SQLite (local network only)
- Cookies use `secure: false` for local network (change for HTTPS)
- Designed for LAN use only - do not expose directly to internet
- No rate limiting implemented (add if needed for production)
- Middleware protects all routes except public paths
- API keys suitable for Homebridge integration (no cookie support needed)

## Testing Strategy

### E2E Tests (Playwright)
Located in `tests/e2e/`, covering:
- **Authentication**: Setup flow, login/logout, session management, API key creation/validation
- **Device Management**: CRUD operations, validation, duplicate detection
- **Wake-on-LAN**: Magic packet sending (mocked network)
- **Status Monitoring**: Online/offline detection via TCP ping
- **API Integration**: Homebridge-compatible API key authentication

**Test Execution**:
- Sequential execution (single worker) for database consistency
- Automatic dev server startup via `webServer` config
- Test database isolation in `tests/fixtures/`
- Mock network operations where needed (WOL, SSH)

**Coverage Areas**:
- ✅ User authentication flows (setup, login, logout)
- ✅ API key lifecycle (create, list, delete, authenticate)
- ✅ Device CRUD operations
- ✅ Dual authentication (JWT + API keys)
- ✅ Error handling and validation
- ⚠️ SSH commands (mocked, requires real Windows PC for integration test)
- ⚠️ Actual WOL (requires hardware on network)

## API Integration (Homebridge Example)

The application supports programmatic access via API keys, making it suitable for Homebridge plugins and automation:

```javascript
// Homebridge plugin example
const API_KEY = 'pcw_xxxxxxxxxxxxx';
const BASE_URL = 'http://localhost:3000';

// Wake device
await fetch(`${BASE_URL}/api/wake`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ macAddress: 'AA:BB:CC:DD:EE:FF' })
});

// Check device status
const response = await fetch(`${BASE_URL}/api/status`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ipAddress: '192.168.1.100' })
});
const { online, rdpReady } = await response.json();
```

**Key Benefits for Integration**:
- No cookie management required
- Stateless authentication
- Per-integration key tracking (`last_used_at`)
- Easy revocation without affecting other integrations

## Homebridge Plugin (Apple HomeKit Integration)

A complete Homebridge plugin is included in the `homebridge-plugin/` directory, allowing you to control your PC and monitor metrics via Apple Home app.

### Features

**v2.1.0+**: Single consolidated accessory with all controls and sensors appearing together on the same page in Home app.

**All services in ONE device**:
- ✅ Device Status (Contact Sensor - online/offline)
- ✅ Wake (Switch)
- ✅ Sleep (Switch)
- ✅ Shutdown (Switch)
- ✅ CPU Usage (Temperature Sensor - °C = % usage)
- ✅ RAM Usage (Humidity Sensor - % = % usage)
- ✅ GPU Usage (Temperature Sensor - °C = % usage)
- ✅ Power Consumption (Light Sensor - Lux = Watts)

**Key improvements over v2.0.0**:
- All 8 services visible on the device page
- No more scattered sensors across different categories
- Device status visible alongside controls
- Cleaner Home app organization

### Installation

```bash
# Navigate to plugin directory
cd homebridge-plugin

# Run installation script
chmod +x install.sh
./install.sh
```

The script will:
1. Install dependencies
2. Link plugin to Homebridge
3. Guide you through configuration (API key, device ID)
4. Generate configuration snippet

### Configuration

Add to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "PCRemoteWake",
      "name": "PC Remote Wake",
      "baseUrl": "http://localhost:3000",
      "apiKey": "pcw_xxxxxxxxxxxxx",
      "deviceId": 1,
      "deviceName": "Gaming PC",
      "pollingInterval": 30
    }
  ]
}
```

### Documentation

- **Quick Start**: See `homebridge-plugin/QUICKSTART.md`
- **Full Documentation**: See `homebridge-plugin/README.md`
- **Migration Guide**: See `homebridge-plugin/MIGRATION.md` (v2.0.0 → v2.1.0 upgrade)
- **Config Schema**: See `homebridge-plugin/config.schema.json` (for Homebridge UI)

### Siri Commands

- "Hey Siri, turn on Wake"
- "Hey Siri, turn on Sleep"
- "Hey Siri, turn on Shutdown"
- "Hey Siri, what's the CPU temperature?"
- "Hey Siri, what's the humidity in Gaming PC?" (RAM usage)

## Background Scheduler & Notifications

The application includes a 24/7 background scheduler for automatic metrics collection and a notification system for power consumption alerts.

### Background Metrics Collection

**Features**:
- Automatic metrics collection at configurable intervals (1-60 minutes)
- Runs independently of UI interactions
- Only collects from online devices (status check first)
- Batch processing with concurrency control (configurable max concurrent devices)
- Automatic retry and error handling
- Collection history tracking with performance metrics

**Configuration** (via `.env`):
```bash
ENABLE_BACKGROUND_METRICS=true  # Enable/disable scheduler
BACKGROUND_METRICS_INTERVAL=300000  # Collection interval in ms (5 minutes default)
BACKGROUND_METRICS_CONCURRENT=3  # Max devices to collect from simultaneously
```

**API Control**:
- `GET /api/scheduler` - Get scheduler state and configuration
- `POST /api/scheduler` - Control actions (start, stop, run-now)
- `PATCH /api/scheduler` - Update configuration

**How It Works**:
1. Scheduler starts automatically on server boot (via `instrumentation.ts`)
2. Every N minutes: checks device status → collects from online devices → stores metrics
3. Logs all collection attempts to `collection_history` table
4. Graceful shutdown on server stop (SIGTERM/SIGINT)

### Notification System

**Features**:
- Power consumption threshold alerts
- Collection failure notifications
- Device offline alerts
- Anti-spam logic (1-hour cooldown for power alerts, 6-hour for offline alerts)
- Unread count tracking
- Mark as read/delete functionality
- Bell icon UI with dropdown panel

**Configuration** (via Settings page):
1. Navigate to Settings (⚙️ button in header)
2. Enable "Enable Power Consumption Alerts" checkbox
3. Set power threshold in watts (e.g., 300W)
4. Save preferences

**Notification Types**:
- **Power Threshold** (`warning`): Triggered when power consumption exceeds threshold
  - Cooldown: 1 hour per device (prevents spam)
  - Example: "High Power Usage: Gaming PC - Power consumption (350.5W) exceeded threshold (300.0W)"

- **Collection Failure** (`error`): Triggered when metrics collection fails
  - Example: "Metrics Collection Failed: Gaming PC - Failed to collect metrics: SSH timeout"

- **Device Offline** (`info`): Triggered when device goes offline
  - Cooldown: 6 hours per device
  - Example: "Device Offline: Gaming PC - Gaming PC is no longer responding"

**API Endpoints**:
- `GET /api/notifications?unreadOnly=true&limit=50` - Get notifications
- `PATCH /api/notifications/[id]` - Mark notification as read
- `DELETE /api/notifications/[id]` - Delete notification
- `POST /api/notifications` - Bulk actions (mark-all-read, cleanup)

**Database Schema**:
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_id INTEGER,
  type TEXT NOT NULL,  -- 'power_threshold' | 'collection_failure' | 'device_offline'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,  -- 'info' | 'warning' | 'error'
  read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User Preferences

**Configurable Settings** (via Settings page):
- **Metrics Collection Interval**: 1-60 minutes (how often UI auto-refreshes when device is online)
- **Enable Notifications**: On/off toggle for power consumption alerts
- **Power Threshold**: Watts value that triggers alerts when exceeded

**API Endpoints**:
- `GET /api/preferences` - Get current user preferences
- `PATCH /api/preferences` - Update preferences

**Database Schema**:
```sql
CREATE TABLE user_preferences (
  user_id INTEGER PRIMARY KEY,
  metrics_poll_interval_ms INTEGER DEFAULT 300000,  -- 5 minutes
  enable_notifications INTEGER DEFAULT 0,  -- 0 = off, 1 = on
  power_threshold_watts REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Collection History

**Features**:
- Tracks all metrics collection attempts (success/failure)
- Performance metrics (collection time in milliseconds)
- Trigger source tracking (scheduler, manual, UI)
- Statistics aggregation (success rate, average collection time)
- Automatic cleanup (retention policy configurable)

**API Endpoints**:
- Collection history is automatically created by scheduler and manual collection
- Statistics can be queried via `collectionHistoryDb.getStats(deviceId, hours)`

**Database Schema**:
```sql
CREATE TABLE collection_history (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,  -- 0 or 1
  error_message TEXT,
  collection_time_ms INTEGER NOT NULL,
  triggered_by TEXT NOT NULL,  -- 'scheduler' | 'manual' | 'ui'
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Windows PC Requirements

- Wake-on-LAN enabled in BIOS and Windows network adapter settings
- Fast Startup disabled for reliable WOL from powered-off state
- OpenSSH server installed for shutdown/sleep commands
- Ports 445 (SMB) or 3389 (RDP) open for status checking
- PowerShell execution policy allows remote scripts (for metrics collection)
- NVIDIA GPU with nvidia-smi for GPU metrics (optional, gracefully fails if unavailable)

## Progressive Web App (PWA) Support

The application can be installed as a mobile app on iOS/Android devices:

### iOS Installation
1. Open Safari on your iPhone/iPad
2. Navigate to your app URL (e.g., `http://192.168.1.100:3000`)
3. Tap the Share button (square with arrow)
4. Scroll down and tap "Add to Home Screen"
5. Name the app and tap "Add"
6. The app will appear on your home screen like a native app

### Android Installation
1. Open Chrome on your Android device
2. Navigate to your app URL
3. Tap the menu (three dots)
4. Tap "Add to Home screen" or "Install app"
5. Follow the prompts to install

### PWA Features
- Standalone app experience (no browser UI)
- Custom app icon on home screen
- Offline-capable (service worker caching)
- Fast loading with precached assets
- Native app-like navigation
