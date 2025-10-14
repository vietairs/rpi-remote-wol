# Homebridge Integration Readiness Analysis
**PC Remote Wake Application**

**Analysis Date**: 2025-10-14
**Target Integration**: Homebridge running at 100.66.154.21 (Raspberry Pi)
**Analysis Mode**: System Architecture Assessment (Analysis-Only)

---

## Executive Summary

**Overall Readiness**: 🟡 **PARTIALLY READY** - Core functionality exists, critical authentication gap blocks integration

**Key Findings**:
- ✅ All required API endpoints exist and functional
- ✅ Network architecture compatible (same LAN)
- ❌ **CRITICAL BLOCKER**: No service-to-service authentication mechanism
- ⚠️ Middleware blocks all API requests without browser-based JWT cookies
- ⚠️ No API documentation or integration specifications

**Estimated Implementation Effort**: 4-6 hours for minimal viable integration

---

## 1. Current State Analysis

### 1.1 API Endpoints Assessment

**Available Endpoints** (All POST except GET /api/devices):

| Endpoint | Method | Function | Status | Homebridge Need |
|----------|--------|----------|--------|-----------------|
| `/api/devices` | GET | List all devices | ✅ Functional | **HIGH** - Device discovery |
| `/api/devices` | POST | Create device | ✅ Functional | MEDIUM - Management only |
| `/api/wake` | POST | Send WOL packet | ✅ Functional | **CRITICAL** - Power on |
| `/api/status` | POST | Check device status | ✅ Functional | **CRITICAL** - State polling |
| `/api/shutdown` | POST | SSH shutdown | ✅ Functional | **CRITICAL** - Power off |
| `/api/sleep` | POST | SSH sleep | ✅ Functional | **HIGH** - Sleep mode |

**Endpoint Details**:

**GET /api/devices**:
```typescript
// Returns: { devices: Device[] }
// No parameters required
// Protected by middleware - requires JWT cookie
```

**POST /api/wake**:
```typescript
// Body: { macAddress: string }  // Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
// Returns: { success: boolean, message: string, macAddress: string }
// Protected by middleware
```

**POST /api/status**:
```typescript
// Body: { ipAddress: string }
// Returns: { ipAddress, online: boolean, rdpReady: boolean, checkedAt: ISO8601 }
// Checks port 445 (SMB) and 3389 (RDP) with 2s timeout
// Protected by middleware
```

**POST /api/shutdown**:
```typescript
// Body: { deviceId: number }
// Returns: { success: boolean, message: string, deviceName: string }
// Requires device with ip_address, ssh_username, ssh_password configured
// Protected by middleware
```

**POST /api/sleep**:
```typescript
// Body: { deviceId: number }
// Returns: { success: boolean, message: string, deviceName: string }
// Requires device with ip_address, ssh_username, ssh_password configured
// Protected by middleware
```

### 1.2 Authentication Architecture

**Current Mechanism**: Browser-based JWT authentication with HTTP-only cookies

**Authentication Flow**:
```
1. User → POST /api/auth/login (username, password)
2. Server → Creates JWT token (7-day expiration)
3. Server → Sets HTTP-only cookie: session=<jwt_token>
4. Middleware → Validates cookie on every protected request
5. No cookie OR invalid JWT → Redirect to /login
```

**JWT Structure** (lib/auth.ts:26-34):
```typescript
{
  userId: number,
  username: string,
  exp: number  // 7 days from creation
}
// Signed with HS256 using JWT_SECRET from environment
```

**Cookie Configuration** (lib/auth.ts:71-80):
```typescript
{
  httpOnly: true,      // Not accessible via JavaScript
  secure: false,       // Designed for HTTP (LAN-only)
  sameSite: 'lax',     // CSRF protection
  maxAge: 604800,      // 7 days in seconds
  path: '/'
}
```

**Middleware Protection** (middleware.ts:5-43):
```typescript
// Public paths (no authentication required):
- /login
- /setup
- /api/auth/login
- /api/auth/init

// All other paths require valid JWT cookie
// Validation: middleware.ts:17-38
// - Checks for 'session' cookie
// - Verifies JWT signature and expiration
// - Redirects to /login if invalid
```

**Critical Gap**: No mechanism for programmatic API access without browser cookies

### 1.3 Network Architecture

**Current Setup**:
- PC Remote Wake app: Running on Raspberry Pi (port not specified in code, likely 3000)
- Homebridge: Running at 100.66.154.21 (same network)
- Target devices: Windows 11 PCs on same LAN

**Network Compatibility**: ✅ **FULLY COMPATIBLE**
- Same LAN subnet (100.66.154.x)
- No NAT/firewall traversal required
- Wake-on-LAN broadcasts work within subnet
- HTTP communication localhost-friendly (secure: false cookies)

**Port Status Check Logic** (app/api/status/route.ts:39-49):
```typescript
// Uses tcp-ping library with 2-second timeout
// Checks Windows ports: 445 (SMB), 3389 (RDP)
// Returns: { online: true if either port responds, rdpReady: true if RDP responds }
```

### 1.4 Database Schema

**Device Storage** (lib/db.ts:60-67):
```sql
CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mac_address TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  ssh_username TEXT,  -- For shutdown/sleep commands
  ssh_password TEXT,  -- Plaintext storage (LAN-only design)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Critical for Homebridge**:
- Device ID required for shutdown/sleep operations
- MAC address required for wake operations
- IP address required for status checks and SSH commands
- SSH credentials required for shutdown/sleep (optional for wake-only)

---

## 2. Integration Gaps Analysis

### 2.1 Authentication Gap (CRITICAL BLOCKER)

**Problem**: Middleware blocks all API requests without JWT cookie

**Current Behavior**:
```
Homebridge → POST /api/wake (no cookie)
            ↓
Middleware → No 'session' cookie found
            ↓
Response → 307 Redirect to /login (Homebridge can't follow browser redirects)
            ↓
Result → Integration FAILS
```

**Why Current Auth Won't Work**:
1. **HTTP-only cookies**: Not accessible to Homebridge plugin code
2. **Browser-specific**: Cookie flow requires browser environment
3. **No token endpoint**: No way to programmatically obtain JWT token
4. **Redirect-based**: Returns 307 redirect instead of 401 Unauthorized
5. **No API key support**: No alternative authentication mechanism

**Impact**: 🔴 **COMPLETE BLOCKER** - Zero API functionality accessible to Homebridge

### 2.2 API Access Patterns

**Missing Features**:
- ❌ API key authentication system
- ❌ Service account mechanism
- ❌ Bearer token support (Authorization header)
- ❌ Long-lived access tokens for services
- ❌ API rate limiting or usage tracking
- ❌ CORS configuration for cross-origin requests (not needed for same-server, but good practice)

**Existing Constraints**:
- Middleware processes ALL routes (middleware.ts:45-56) except static assets
- No bypass mechanism for service-to-service communication
- Public paths hardcoded in middleware (middleware.ts:9)

### 2.3 Documentation Gap

**Missing Documentation**:
- ❌ API endpoint specifications (request/response schemas)
- ❌ Authentication guide for integrations
- ❌ Error code documentation
- ❌ Rate limiting information
- ❌ Example integration code
- ❌ OpenAPI/Swagger specification

**Impact**: ⚠️ **MEDIUM** - Increases integration complexity and maintenance burden

### 2.4 Operational Gaps

**Missing Features for Production Integration**:
- ❌ API versioning (e.g., `/api/v1/wake`)
- ❌ Request validation with detailed error messages
- ❌ Logging/audit trail for API access
- ❌ Health check endpoint for monitoring
- ❌ Metrics/telemetry for integration debugging
- ❌ Webhook support for status change notifications

**Impact**: 🟡 **LOW-MEDIUM** - Not blockers, but reduce reliability and debuggability

---

## 3. Required Changes

### 3.1 Authentication Solution (CRITICAL - Priority 1)

**Option A: API Key Authentication (RECOMMENDED)**

**Implementation Strategy**:
```typescript
// 1. Environment Configuration (.env)
HOMEBRIDGE_API_KEY=<generated-secret>  // Use openssl rand -hex 32

// 2. Middleware Update (middleware.ts)
- Add API key validation path
- Check for 'X-API-Key' header OR 'api_key' query parameter
- Bypass JWT check if valid API key present
- Log API key usage for audit

// 3. New endpoint (optional): POST /api/auth/validate-key
- Validates API key without creating session
- Returns: { valid: boolean, permissions?: string[] }
```

**Middleware Logic Addition**:
```typescript
// In middleware.ts, before JWT check (after line 14):

// Check for API key authentication
const apiKey = request.headers.get('x-api-key') ||
               request.nextUrl.searchParams.get('api_key');

if (apiKey && apiKey === process.env.HOMEBRIDGE_API_KEY) {
  console.log('[Middleware] API key authentication successful');
  return NextResponse.next();
}

// Continue with existing JWT cookie check...
```

**Pros**:
- Simple implementation (~30 lines of code)
- No database changes required
- Minimal security risk (single static key, LAN-only)
- Works with any HTTP client (curl, fetch, axios)

**Cons**:
- Single key for all access (no granular permissions)
- Key rotation requires environment update + Homebridge config update
- No per-service audit trail (all requests look same)

**Security Considerations**:
- API key should be stored in .env file (not committed to git)
- Homebridge config.json stores key (file permissions important)
- LAN-only design reduces exposure risk
- Consider key rotation policy (every 90 days?)

**Option B: Service Account with JWT (ADVANCED)**

**Implementation Strategy**:
```typescript
// 1. Database Schema Addition
CREATE TABLE service_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,  -- e.g., "homebridge"
  api_key_hash TEXT NOT NULL,  -- Bcrypt hash
  permissions TEXT,            -- JSON array: ["wake", "status", "shutdown"]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME
);

// 2. New API Endpoint: POST /api/auth/service-token
// Body: { apiKey: string }
// Returns: { token: string, expiresIn: number }

// 3. Middleware Update
- Check for 'Authorization: Bearer <token>' header
- Verify token (separate from user JWT)
- Allow service account permissions
```

**Pros**:
- Granular permissions per service account
- Token rotation without Homebridge config changes
- Audit trail per service account
- Scalable to multiple integrations

**Cons**:
- More complex implementation (~200 lines of code)
- Database schema changes required
- Management UI needed for service accounts
- Overkill for single Homebridge integration

**Recommendation**: **Option A (API Key)** for MVP, consider Option B if multiple integrations needed

### 3.2 API Enhancements (Priority 2)

**Device Discovery Enhancement**:
```typescript
// Current: GET /api/devices returns full device list
// Enhancement: Add filtering and minimal response option

GET /api/devices?fields=id,name,mac_address,ip_address
// Returns only essential fields (reduces response size)

GET /api/devices?has_ssh=true
// Returns only devices with SSH configured (for shutdown/sleep capability)
```

**Batch Operations Support**:
```typescript
// New endpoint: POST /api/batch/wake
// Body: { devices: [{ macAddress: string }, ...] }
// Returns: { results: [{ macAddress, success, error? }] }

// Use case: Homebridge scene to wake multiple PCs
```

**Status Polling Optimization**:
```typescript
// New endpoint: POST /api/batch/status
// Body: { devices: [{ ipAddress: string }, ...] }
// Returns: { results: [{ ipAddress, online, rdpReady, checkedAt }] }

// Reduces Homebridge polling overhead (1 request vs N requests)
```

**Health Check Endpoint**:
```typescript
// New endpoint: GET /api/health
// Public (no authentication required)
// Returns: { status: "healthy", version: "1.0.0", uptime: number }

// Homebridge uses this to detect app availability
```

### 3.3 Error Response Standardization (Priority 3)

**Current Issues**:
- Inconsistent error response formats
- Missing error codes for programmatic handling
- Redirects instead of proper HTTP status codes for auth failures

**Proposed Standard Format**:
```typescript
// All API errors return:
{
  error: {
    code: "AUTHENTICATION_FAILED",  // Machine-readable
    message: "Invalid API key",      // Human-readable
    details?: any,                   // Optional debug info
    timestamp: "2025-10-14T10:30:00Z"
  }
}

// HTTP Status Codes:
401 - Authentication failed (invalid API key/token)
403 - Forbidden (valid auth but insufficient permissions)
404 - Resource not found (invalid device ID)
422 - Validation error (invalid MAC address format)
500 - Server error (database failure, SSH timeout)
```

**Error Code Catalog**:
```typescript
// Authentication
- AUTH_MISSING: No API key or token provided
- AUTH_INVALID: Invalid API key or expired token
- AUTH_FORBIDDEN: Valid auth but insufficient permissions

// Validation
- VALIDATION_MAC_FORMAT: Invalid MAC address format
- VALIDATION_IP_FORMAT: Invalid IP address format
- VALIDATION_MISSING_FIELD: Required field missing

// Device Operations
- DEVICE_NOT_FOUND: Device ID doesn't exist
- DEVICE_NO_IP: Device missing IP address for operation
- DEVICE_NO_SSH: Device missing SSH credentials
- DEVICE_OFFLINE: Device not responding to status check

// Network Operations
- WOL_SEND_FAILED: Failed to send magic packet
- SSH_CONNECTION_FAILED: SSH connection timeout or refused
- SSH_COMMAND_FAILED: SSH command execution error
- STATUS_CHECK_TIMEOUT: Port check timeout
```

### 3.4 Documentation Requirements (Priority 3)

**API Documentation**:
```markdown
# API Reference

## Authentication
- Header: `X-API-Key: <your-api-key>`
- Query: `?api_key=<your-api-key>`

## Endpoints

### GET /api/devices
List all configured devices
**Authentication**: Required
**Response**: { devices: Device[] }

### POST /api/wake
Send Wake-on-LAN packet
**Authentication**: Required
**Body**: { macAddress: "AA:BB:CC:DD:EE:FF" }
**Response**: { success: true, message: "...", macAddress: "..." }
**Errors**: 400 (invalid format), 500 (send failed)

[... continued for all endpoints ...]
```

**Integration Guide**:
```markdown
# Homebridge Integration Guide

## Prerequisites
1. PC Remote Wake app running on Raspberry Pi
2. Homebridge installed and running
3. Devices configured in PC Remote Wake

## Setup Steps
1. Generate API key: `openssl rand -hex 32`
2. Add to .env: `HOMEBRIDGE_API_KEY=<generated-key>`
3. Restart PC Remote Wake app
4. Install Homebridge plugin: `npm install homebridge-pc-remote-wake`
5. Configure plugin in Homebridge config.json

## Configuration
[... example config.json ...]

## Troubleshooting
[... common issues and solutions ...]
```

---

## 4. Implementation Approach

### 4.1 Phase 1: MVP Authentication (Est. 2-3 hours)

**Goal**: Enable Homebridge API access with minimal changes

**Tasks**:
1. Add `HOMEBRIDGE_API_KEY` to environment variables
2. Update middleware.ts to check API key header/query parameter
3. Test API key authentication with curl/Postman
4. Document API key setup process

**Deliverables**:
- Modified `middleware.ts` with API key support
- `.env.example` with `HOMEBRIDGE_API_KEY` placeholder
- Simple API documentation in `HOMEBRIDGE_INTEGRATION.md`

**Testing**:
```bash
# Test device list
curl -H "X-API-Key: your-key-here" http://100.66.154.21:3000/api/devices

# Test wake
curl -X POST -H "X-API-Key: your-key-here" \
     -H "Content-Type: application/json" \
     -d '{"macAddress":"AA:BB:CC:DD:EE:FF"}' \
     http://100.66.154.21:3000/api/wake

# Test status
curl -X POST -H "X-API-Key: your-key-here" \
     -H "Content-Type: application/json" \
     -d '{"ipAddress":"192.168.1.100"}' \
     http://100.66.154.21:3000/api/status
```

### 4.2 Phase 2: API Enhancements (Est. 2-3 hours)

**Goal**: Optimize API for Homebridge usage patterns

**Tasks**:
1. Add health check endpoint (`/api/health`)
2. Standardize error responses with error codes
3. Add batch status endpoint for efficient polling
4. Add API request logging for debugging

**Deliverables**:
- New `/api/health` endpoint
- Updated error handling across all endpoints
- New `/api/batch/status` endpoint
- Logging middleware for API requests

**Testing**:
```bash
# Test health check
curl http://100.66.154.21:3000/api/health

# Test batch status
curl -X POST -H "X-API-Key: your-key-here" \
     -H "Content-Type: application/json" \
     -d '{"devices":[{"ipAddress":"192.168.1.100"},{"ipAddress":"192.168.1.101"}]}' \
     http://100.66.154.21:3000/api/batch/status
```

### 4.3 Phase 3: Homebridge Plugin Development (Est. 4-6 hours)

**Goal**: Create custom Homebridge plugin for PC Remote Wake

**Plugin Structure**:
```
homebridge-pc-remote-wake/
├── package.json
├── index.js           # Main plugin entry point
├── src/
│   ├── platform.js    # Platform accessory registration
│   ├── accessory.js   # Individual PC accessory
│   └── api-client.js  # PC Remote Wake API wrapper
└── config.schema.json # Homebridge UI configuration
```

**Plugin Capabilities**:
- Exposes each device as HomeKit Switch accessory
- Switch ON → Wake-on-LAN
- Switch OFF → SSH shutdown (if configured)
- Status polling every 30 seconds (configurable)
- Supports sleep mode as separate switch (optional)

**Configuration Example**:
```json
{
  "platform": "PCRemoteWake",
  "name": "PC Remote Wake",
  "apiUrl": "http://100.66.154.21:3000",
  "apiKey": "your-api-key-here",
  "pollInterval": 30,
  "devices": [
    {
      "id": 1,
      "name": "Gaming PC",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "ipAddress": "192.168.1.100",
      "supportsShutdown": true,
      "supportsSleep": true
    }
  ]
}
```

### 4.4 Phase 4: Documentation & Polish (Est. 1-2 hours)

**Tasks**:
1. Complete API reference documentation
2. Write Homebridge plugin installation guide
3. Add troubleshooting section
4. Create example configurations
5. Add logging best practices

**Deliverables**:
- `HOMEBRIDGE_INTEGRATION.md` - Complete integration guide
- `API_REFERENCE.md` - Full API specification
- Updated `CLAUDE.md` with Homebridge integration notes

---

## 5. Risk Assessment

### 5.1 Security Risks

**API Key Exposure** - 🟡 MEDIUM Risk
- **Threat**: API key stored in Homebridge config.json (plaintext)
- **Mitigation**: File permissions (chmod 600), LAN-only access
- **Impact**: If compromised, attacker can control all devices
- **Likelihood**: LOW (requires Raspberry Pi filesystem access)

**No Rate Limiting** - 🟡 MEDIUM Risk
- **Threat**: Malicious API key holder floods API with requests
- **Mitigation**: Add rate limiting middleware (express-rate-limit)
- **Impact**: Database lock contention, DOS
- **Likelihood**: LOW (LAN-only, trusted network)

**SSH Credentials in Database** - 🟢 LOW Risk (Existing)
- **Threat**: Database file exposure reveals SSH passwords
- **Mitigation**: Already acknowledged in CLAUDE.md (LAN-only design)
- **Impact**: Attacker can SSH into Windows PCs
- **Likelihood**: LOW (requires filesystem access + same network)

**No API Key Rotation** - 🟢 LOW Risk
- **Threat**: Long-lived static key increases exposure window
- **Mitigation**: Document key rotation procedure
- **Impact**: Requires Homebridge reconfiguration
- **Likelihood**: LOW (manual rotation acceptable for single integration)

### 5.2 Reliability Risks

**Status Polling Overhead** - 🟡 MEDIUM Risk
- **Threat**: Homebridge polls every 30s → database contention
- **Mitigation**: Batch status endpoint, WAL mode already enabled
- **Impact**: Slower response times, potential timeouts
- **Likelihood**: MEDIUM (multiple devices × 30s polling)

**SSH Connection Timeouts** - 🟡 MEDIUM Risk
- **Threat**: Shutdown/sleep commands timeout if PC busy
- **Mitigation**: Already implemented (10s timeout)
- **Impact**: Homebridge shows "not responding"
- **Likelihood**: MEDIUM (Windows startup/shutdown delays common)

**WOL Reliability** - 🟡 MEDIUM Risk (Existing)
- **Threat**: Magic packets may not wake PC (BIOS settings, network issues)
- **Mitigation**: User configuration validation, troubleshooting guide
- **Impact**: HomeKit shows "on" but PC stays off
- **Likelihood**: MEDIUM (common user misconfiguration)

**App Downtime** - 🟢 LOW Risk
- **Threat**: PC Remote Wake app crashes/restarts
- **Mitigation**: Health check endpoint, systemd service with restart
- **Impact**: Homebridge accessories show "no response"
- **Likelihood**: LOW (Next.js stable, simple app)

### 5.3 Integration Risks

**Homebridge Plugin Compatibility** - 🟡 MEDIUM Risk
- **Threat**: Homebridge API changes break plugin
- **Mitigation**: Pin Homebridge version in plugin dependencies
- **Impact**: Plugin stops working after Homebridge update
- **Likelihood**: LOW (Homebridge API stable)

**HomeKit Accessory Limits** - 🟢 LOW Risk
- **Threat**: HomeKit bridge limit (150 accessories)
- **Mitigation**: Each PC = 1-3 accessories (switch, sleep switch)
- **Impact**: Can't add more PCs to Homebridge
- **Likelihood**: LOW (typical use: 1-5 PCs)

**Device ID Stability** - 🟢 LOW Risk
- **Threat**: Device IDs change after database reset
- **Mitigation**: Homebridge plugin uses MAC address as identifier
- **Impact**: Accessories lose pairing
- **Likelihood**: LOW (SQLite autoincrement IDs stable)

### 5.4 Operational Risks

**API Version Compatibility** - 🟡 MEDIUM Risk
- **Threat**: PC Remote Wake API changes break Homebridge plugin
- **Mitigation**: API versioning (future), semantic versioning
- **Impact**: Homebridge plugin stops working after app update
- **Likelihood**: MEDIUM (no versioning currently)

**Configuration Drift** - 🟢 LOW Risk
- **Threat**: Device config in PC Remote Wake vs Homebridge config.json out of sync
- **Mitigation**: Homebridge plugin fetches devices from API on startup
- **Impact**: Accessories don't match actual devices
- **Likelihood**: LOW (plugin can refresh from API)

**Logging/Debugging Difficulty** - 🟡 MEDIUM Risk
- **Threat**: Hard to troubleshoot issues without proper logging
- **Mitigation**: Add API request logging, Homebridge debug mode
- **Impact**: Slow issue resolution
- **Likelihood**: MEDIUM (debugging distributed system challenging)

---

## 6. Recommendations

### 6.1 Immediate Actions (Required for Integration)

**Priority 1: Authentication**
1. Implement API key authentication in middleware (Option A)
2. Generate secure API key: `openssl rand -hex 32`
3. Add `HOMEBRIDGE_API_KEY` to `.env` file
4. Test API access with curl before Homebridge integration

**Priority 2: Basic Documentation**
1. Create `HOMEBRIDGE_INTEGRATION.md` with:
   - API key setup instructions
   - Endpoint reference (wake, status, shutdown, sleep)
   - Example curl commands for testing
   - Error response documentation

**Priority 3: Error Handling**
1. Standardize error responses across all API endpoints
2. Return proper HTTP status codes (401 for auth, not 307 redirect)
3. Add machine-readable error codes

### 6.2 Short-Term Enhancements (Within 1 week)

**API Improvements**:
1. Add `/api/health` endpoint for monitoring
2. Add `/api/batch/status` for efficient polling
3. Implement request logging for debugging
4. Add API request/response examples to documentation

**Reliability**:
1. Add rate limiting middleware (10 req/min per API key)
2. Add retry logic for SSH connections (3 attempts with backoff)
3. Monitor database performance under load

**Security**:
1. Document API key rotation procedure
2. Add API key last-used timestamp logging
3. Consider API key expiration (warn after 90 days)

### 6.3 Long-Term Improvements (Optional)

**Advanced Authentication** (if multiple integrations needed):
1. Implement service account system with granular permissions
2. Add API key management UI in web app
3. Support multiple API keys with different scopes

**Enhanced Monitoring**:
1. Add Prometheus metrics endpoint
2. Implement webhook notifications for device state changes
3. Add detailed audit logging (who accessed what, when)

**API Versioning**:
1. Version API endpoints (`/api/v1/wake`)
2. Support multiple API versions simultaneously
3. Document deprecation policy

**Homebridge Plugin Features**:
1. Auto-discovery of PC Remote Wake app on network
2. Support for Sleep mode as separate accessory
3. Battery status for laptops (if detectable)
4. Configuration UI in Homebridge web interface

### 6.4 Decision Matrix

**Authentication Approach**:
```
Scenario 1: Single Homebridge integration, LAN-only
→ Recommendation: API Key (Option A)
→ Rationale: Simple, secure enough for LAN, fast implementation

Scenario 2: Multiple integrations (Home Assistant, CLI tools, etc.)
→ Recommendation: Service Accounts (Option B)
→ Rationale: Granular permissions, scalable, better audit trail

Scenario 3: Internet-exposed API (future possibility)
→ Recommendation: OAuth2 with scoped tokens
→ Rationale: Industry standard, secure for public internet
```

**Implementation Timeline**:
```
Week 1: Authentication + Basic Documentation
- Days 1-2: Implement API key authentication
- Days 3-4: Write API documentation
- Day 5: Testing and validation

Week 2: API Enhancements + Homebridge Plugin MVP
- Days 1-2: Health check, error standardization
- Days 3-5: Basic Homebridge plugin development

Week 3: Testing + Refinement
- Days 1-3: Integration testing
- Days 4-5: Documentation polish, troubleshooting guide
```

---

## 7. Technical Specifications

### 7.1 Proposed Middleware Changes

**File**: `/Users/hvnguyen/Projects/rpi-remote-wol/middleware.ts`

**Changes Required**:
```typescript
// Line 8-9: Expand public paths to include health check
const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init', '/api/health'];

// Line 14: Add API key check BEFORE JWT cookie check
// NEW CODE (insert after line 14, before line 17):
const apiKey = request.headers.get('x-api-key') ||
               request.nextUrl.searchParams.get('api_key');

if (apiKey) {
  if (apiKey === process.env.HOMEBRIDGE_API_KEY) {
    console.log('[Middleware] API key authentication successful for', pathname);
    return NextResponse.next();
  } else {
    console.log('[Middleware] Invalid API key for', pathname);
    return NextResponse.json(
      { error: { code: 'AUTH_INVALID', message: 'Invalid API key' } },
      { status: 401 }
    );
  }
}

// Continue with existing JWT cookie logic (line 17-42)...
```

**Rationale**:
- Check API key first (service-to-service auth)
- Fall back to JWT cookie (browser auth)
- Return 401 JSON instead of 307 redirect for API key failures
- Log authentication method for debugging

### 7.2 Environment Configuration

**File**: `.env` (create if doesn't exist)

```bash
# JWT Secret (existing)
JWT_SECRET=<generated-secret>  # openssl rand -base64 32

# Homebridge API Key (NEW)
HOMEBRIDGE_API_KEY=<generated-key>  # openssl rand -hex 32

# Optional: Rate limiting (future)
API_RATE_LIMIT=10  # requests per minute per API key
```

**File**: `.env.example` (NEW - commit to git)

```bash
# JWT Secret for user session authentication
# Generate with: openssl rand -base64 32
JWT_SECRET=your-secret-key-change-this-in-production

# Homebridge API Key for service-to-service authentication
# Generate with: openssl rand -hex 32
HOMEBRIDGE_API_KEY=your-api-key-here

# Optional: API rate limiting (requests per minute)
# API_RATE_LIMIT=10
```

### 7.3 Health Check Endpoint Specification

**File**: `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/health/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { deviceDb } from '@/lib/db';

export async function GET() {
  try {
    // Test database connectivity
    const deviceCount = deviceDb.getAll().length;

    return NextResponse.json({
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        deviceCount
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
```

**Usage**:
```bash
# Check app health
curl http://100.66.154.21:3000/api/health

# Response (healthy):
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12345.67,
  "timestamp": "2025-10-14T10:30:00Z",
  "database": {
    "connected": true,
    "deviceCount": 3
  }
}

# Response (unhealthy):
{
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2025-10-14T10:30:00Z"
}
```

### 7.4 Batch Status Endpoint Specification

**File**: `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/batch/status/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { probe } from 'tcp-ping';

export async function POST(request: NextRequest) {
  try {
    const { devices } = await request.json();

    if (!devices || !Array.isArray(devices)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_MISSING_FIELD', message: 'devices array is required' } },
        { status: 400 }
      );
    }

    if (devices.length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (devices.length > 10) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_TOO_MANY', message: 'Maximum 10 devices per batch' } },
        { status: 400 }
      );
    }

    // Check all devices in parallel
    const results = await Promise.all(
      devices.map(async ({ ipAddress }) => {
        if (!ipAddress) {
          return {
            ipAddress: null,
            online: false,
            rdpReady: false,
            error: 'IP address missing',
            checkedAt: new Date().toISOString()
          };
        }

        try {
          const hostCheck = await checkPort(ipAddress, 445, 2000);
          const rdpCheck = await checkPort(ipAddress, 3389, 2000);

          return {
            ipAddress,
            online: hostCheck || rdpCheck,
            rdpReady: rdpCheck,
            checkedAt: new Date().toISOString()
          };
        } catch (error) {
          return {
            ipAddress,
            online: false,
            rdpReady: false,
            error: error instanceof Error ? error.message : 'Check failed',
            checkedAt: new Date().toISOString()
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch status check error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to check device status' } },
      { status: 500 }
    );
  }
}

function checkPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    probe(host, port, (err, available) => {
      resolve(err ? false : available);
    }, { timeout });
  });
}
```

**Usage**:
```bash
# Check multiple devices
curl -X POST -H "X-API-Key: your-key-here" \
     -H "Content-Type: application/json" \
     -d '{
       "devices": [
         {"ipAddress": "192.168.1.100"},
         {"ipAddress": "192.168.1.101"},
         {"ipAddress": "192.168.1.102"}
       ]
     }' \
     http://100.66.154.21:3000/api/batch/status

# Response:
{
  "results": [
    {
      "ipAddress": "192.168.1.100",
      "online": true,
      "rdpReady": true,
      "checkedAt": "2025-10-14T10:30:00Z"
    },
    {
      "ipAddress": "192.168.1.101",
      "online": false,
      "rdpReady": false,
      "checkedAt": "2025-10-14T10:30:00Z"
    },
    {
      "ipAddress": "192.168.1.102",
      "online": true,
      "rdpReady": false,
      "checkedAt": "2025-10-14T10:30:00Z"
    }
  ]
}
```

---

## 8. Conclusion

### Summary

**Current Readiness**: 🟡 **65% Ready**
- ✅ Core functionality complete (wake, status, shutdown, sleep)
- ✅ Network architecture compatible
- ✅ Database schema adequate
- ❌ **Authentication mechanism missing** (CRITICAL BLOCKER)
- ⚠️ API documentation incomplete
- ⚠️ Error handling inconsistent

**Estimated Total Effort**: 8-12 hours
- Authentication implementation: 2-3 hours
- API enhancements: 2-3 hours
- Documentation: 1-2 hours
- Homebridge plugin: 4-6 hours (separate project)

**Critical Path**:
1. **Authentication** (BLOCKER) → 2-3 hours
2. **API Documentation** (HIGH) → 1-2 hours
3. **Error Standardization** (MEDIUM) → 1-2 hours
4. **Homebridge Plugin** (SEPARATE) → 4-6 hours

### Key Recommendations

**Must-Have for MVP**:
1. API key authentication in middleware
2. Basic API documentation (endpoint reference)
3. Standardized error responses

**Should-Have for Production**:
1. Health check endpoint
2. Batch status endpoint
3. Request logging and monitoring
4. Rate limiting

**Nice-to-Have for Future**:
1. Service account system
2. API versioning
3. Webhook notifications
4. Prometheus metrics

### Next Steps

**Immediate** (Do First):
1. Generate API key: `openssl rand -hex 32`
2. Modify `middleware.ts` with API key check
3. Create `.env.example` with API key placeholder
4. Test API access with curl

**Week 1** (After Authentication Works):
1. Create `/api/health` endpoint
2. Write `HOMEBRIDGE_INTEGRATION.md` documentation
3. Standardize error responses across endpoints
4. Test all endpoints with Postman/curl

**Week 2** (After API Ready):
1. Begin Homebridge plugin development
2. Implement batch status endpoint
3. Add request logging
4. Create troubleshooting guide

**Success Criteria**:
- ✅ Homebridge can wake PC via API
- ✅ Homebridge can check PC status via API
- ✅ Homebridge can shutdown PC via API
- ✅ API authentication works reliably
- ✅ Error messages are clear and actionable
- ✅ Documentation covers all integration scenarios

---

## Appendix A: File Locations

**Files to Modify**:
- `/Users/hvnguyen/Projects/rpi-remote-wol/middleware.ts` - Add API key authentication
- `/Users/hvnguyen/Projects/rpi-remote-wol/.env` - Add HOMEBRIDGE_API_KEY

**Files to Create**:
- `/Users/hvnguyen/Projects/rpi-remote-wol/.env.example` - Template with API key placeholder
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/health/route.ts` - Health check endpoint
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/batch/status/route.ts` - Batch status endpoint
- `/Users/hvnguyen/Projects/rpi-remote-wol/HOMEBRIDGE_INTEGRATION.md` - Integration documentation
- `/Users/hvnguyen/Projects/rpi-remote-wol/API_REFERENCE.md` - API specification

**Existing Files (No Changes Needed)**:
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/wake/route.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/status/route.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/shutdown/route.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/sleep/route.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/devices/route.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/lib/db.ts` - Already functional
- `/Users/hvnguyen/Projects/rpi-remote-wol/lib/auth.ts` - Already functional (JWT for browser)

## Appendix B: Testing Checklist

**Pre-Integration Testing** (Before Homebridge):
```bash
# 1. Generate API key
openssl rand -hex 32

# 2. Add to .env file
echo "HOMEBRIDGE_API_KEY=<generated-key>" >> .env

# 3. Restart app
npm run dev  # or systemctl restart pc-remote-wake

# 4. Test health check (no auth)
curl http://100.66.154.21:3000/api/health

# 5. Test device list with API key
curl -H "X-API-Key: <your-key>" http://100.66.154.21:3000/api/devices

# 6. Test wake
curl -X POST -H "X-API-Key: <your-key>" \
     -H "Content-Type: application/json" \
     -d '{"macAddress":"AA:BB:CC:DD:EE:FF"}' \
     http://100.66.154.21:3000/api/wake

# 7. Test status
curl -X POST -H "X-API-Key: <your-key>" \
     -H "Content-Type: application/json" \
     -d '{"ipAddress":"192.168.1.100"}' \
     http://100.66.154.21:3000/api/status

# 8. Test invalid API key (should return 401)
curl -H "X-API-Key: invalid" http://100.66.154.21:3000/api/devices

# 9. Test missing API key (should return 401, not redirect)
curl http://100.66.154.21:3000/api/devices
```

**Post-Integration Testing** (After Homebridge Plugin):
- [ ] Homebridge discovers all devices
- [ ] HomeKit switch turns on → PC wakes up
- [ ] HomeKit switch turns off → PC shuts down
- [ ] HomeKit shows correct status (on/off)
- [ ] Status updates within 30 seconds
- [ ] Works after Homebridge restart
- [ ] Works after PC Remote Wake app restart
- [ ] Error handling graceful (timeout, offline, etc.)

---

**Report Generated**: 2025-10-14
**Analysis Mode**: System Architecture (Analysis-Only)
**Analyst**: Claude Code (System Architect Persona)
