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

### Environment Setup
```bash
# Generate JWT secret
openssl rand -base64 32

# Create .env file with:
JWT_SECRET=<generated-secret>
```

### Database Location
SQLite database is auto-created at `data/devices.db` on first run. Contains:
- `users` table (username, password_hash)
- `devices` table (name, mac_address, ip_address, ssh_username, ssh_password)

## Architecture

### Framework & Stack
- **Framework**: Next.js 15 with App Router (React 19)
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via better-sqlite3 with WAL mode
- **Authentication**: JWT with jose library, bcryptjs password hashing
- **Network**: wake_on_lan for WOL, node-ssh for remote commands, tcp-ping for status checks

### Key Directories
```
app/
├── api/              # API route handlers
│   ├── auth/        # Authentication endpoints (login, logout, session, init)
│   ├── devices/     # Device CRUD operations
│   ├── wake/        # Wake-on-LAN endpoint
│   ├── shutdown/    # SSH shutdown endpoint
│   ├── sleep/       # SSH sleep endpoint
│   ├── status/      # Device status checking (TCP ping)
│   └── discover-ip/ # ARP-based IP discovery
├── login/           # Login page
├── setup/           # First-time admin account creation
└── page.tsx         # Main dashboard

lib/
├── db.ts            # Database layer (deviceDb, userDb)
└── auth.ts          # Auth utilities (JWT, bcrypt, session management)

middleware.ts         # Route protection (JWT verification)
```

### Core Components

#### Database Layer ([lib/db.ts](lib/db.ts))
- Lazy initialization pattern with singleton instance
- WAL mode enabled for better concurrency
- Automatic schema migrations (adds columns if missing)
- Separate namespaces: `deviceDb` and `userDb`
- Uses prepared statements for all queries

#### Authentication ([lib/auth.ts](lib/auth.ts))
- JWT tokens with 7-day expiration
- HTTP-only cookies with `sameSite: 'lax'`
- `secure: false` (designed for local network, change for HTTPS)
- Bcrypt with 10 rounds for password hashing
- Session data: `{ userId, username, exp }`

#### Middleware ([middleware.ts](middleware.ts))
- Protects all routes except `/login`, `/setup`, `/api/auth/*`
- JWT verification on every request
- Redirects to `/login` for invalid/missing tokens
- Excludes static assets and images

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

### Authentication Flow

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

### Device Management Flow

1. **Add Device**: POST `/api/devices` with `{ name, mac_address, ip_address?, ssh_username?, ssh_password? }`
2. **Wake Device**: POST `/api/wake` with `{ macAddress }`
3. **Check Status**: POST `/api/status` with `{ ipAddress }`
4. **Remote Commands**: POST `/api/shutdown` or `/api/sleep` with `{ deviceId }`

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
// In API routes
import { getSession } from '@/lib/auth';
const session = await getSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
- SSH credentials stored in plaintext in SQLite (local network only)
- Cookies use `secure: false` for local network (change for HTTPS)
- Designed for LAN use only - do not expose directly to internet
- No rate limiting implemented (add if needed for production)
- Middleware protects all routes except public paths

## Testing Notes

- No test suite currently exists
- Manual testing workflow:
  1. Test first-time setup flow
  2. Test login/logout
  3. Test device CRUD operations
  4. Test WOL with real device on network
  5. Test status monitoring
  6. Test SSH commands (requires OpenSSH on Windows)

## Windows PC Requirements

- Wake-on-LAN enabled in BIOS and Windows network adapter settings
- Fast Startup disabled for reliable WOL from powered-off state
- OpenSSH server installed for shutdown/sleep commands
- Ports 445 (SMB) or 3389 (RDP) open for status checking
