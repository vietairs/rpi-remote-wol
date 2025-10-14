# PC System Monitoring Implementation Plan

**Project**: PC Remote Wake - System Monitoring Feature
**Created**: 2025-10-15
**Last Updated**: 2025-10-15
**Status**: 🔄 In Progress - Backend Complete
**Overall Progress**: 14% (1/7 phases completed)

---

## 📋 Executive Summary

Add comprehensive system monitoring (CPU, RAM, GPU, Network) to the PC Remote Wake application, with real-time dashboard visualization and optional Apple Home integration via Homebridge.

**Goal**: Create btop-like monitoring experience accessible via web dashboard and Apple Home app.

**Target Devices**: Windows 11 PCs with SSH enabled
**Deployment**: Raspberry Pi (Next.js app + Homebridge)

---

## 🎯 Project Milestones

| Milestone | Target Date | Status | Progress |
|-----------|-------------|--------|----------|
| Phase 1: Backend Foundation | 2025-10-15 | ✅ Complete | 100% |
| Phase 2: API Development | TBD | ⏳ Not Started | 0% (Phase 1 included API endpoints) |
| Phase 3: Frontend Dashboard | TBD | ⏳ Not Started | 0% |
| Phase 4: Homebridge Integration | TBD | ⏳ Not Started | 0% |
| Phase 5: Testing & Optimization | TBD | ⏳ Not Started | 0% |
| Phase 6: Documentation | TBD | ⏳ Not Started | 0% |
| Phase 7: Deployment | TBD | ⏳ Not Started | 0% |

**Legend**: ⏳ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked | ⚠️ Needs Review

**Overall Progress**: 14% (1/7 phases completed)

---

## 🏗️ Architecture Overview

### **Data Flow**
```
Windows PC (SSH) → PowerShell Commands → Metrics Data
                                              ↓
                                    Next.js API (/api/metrics/*)
                                              ↓
                                    SQLite Database (system_metrics)
                                              ↓
                                    ┌─────────┴─────────┐
                                    ↓                   ↓
                          Web Dashboard        Homebridge Plugin
                          (Real-time UI)       (Apple Home)
```

### **Technology Stack**
- **Backend**: Next.js 15 API Routes, node-ssh, better-sqlite3
- **Frontend**: React 19, Tailwind CSS, Recharts
- **Windows**: PowerShell (performance counters, nvidia-smi)
- **Homebridge**: Custom plugin (homebridge-pc-monitor)
- **Database**: SQLite with 24-hour retention policy

---

## 📊 Implementation Phases

### **Phase 1: Backend Foundation**
**Status**: ✅ Complete | **Progress**: 100% | **Completed**: 2025-10-15

#### Tasks
- [x] 1.1: Extend database schema with `system_metrics` table
  - **Status**: ✅ Complete
  - **File**: `lib/db.ts`
  - **Details**: Added table creation, indexes (idx_metrics_device_time), and cleanup logic

- [x] 1.2: Create metrics collection service
  - **Status**: ✅ Complete
  - **File**: `lib/metrics.ts`
  - **Details**: SSH connection with node-ssh, PowerShell execution, data parsing with error handling

- [x] 1.3: Implement PowerShell commands for Windows metrics
  - **Status**: ✅ Complete
  - **Commands**: CPU (Get-Counter), RAM (CIM), GPU (nvidia-smi), Network (Get-NetAdapterStatistics)
  - **Testing**: Ready for Windows 11 PC testing

- [x] 1.4: API endpoints created
  - **Status**: ✅ Complete
  - **Files**:
    - `/api/metrics/collect` - POST endpoint for collection
    - `/api/metrics/[deviceId]/latest` - GET latest metrics
    - `/api/metrics/[deviceId]` - GET historical metrics (1h/6h/24h)
    - `/api/metrics/cleanup` - POST cleanup old metrics

#### Deliverables
- ✅ Database schema updated with system_metrics table
- ✅ Metrics collection service functional with TypeScript types
- ✅ PowerShell commands implemented (CPU, RAM, GPU, Network)
- ✅ All API endpoints created and type-safe
- ✅ Production build successful

#### Blockers / Notes
- **Note**: Network metrics return null (requires delta calculation between samples for rate)
- **Note**: GPU metrics only work with NVIDIA GPUs (nvidia-smi command)
- **Ready for**: Phase 2 testing with actual Windows PC

---

### **Phase 2: API Development**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 2-3 hours

#### Tasks
- [ ] 2.1: Create `/api/metrics/collect` endpoint
  - **Status**: ⏳ Not Started
  - **Method**: POST
  - **Input**: `{ deviceId }`
  - **Output**: Latest metrics snapshot

- [ ] 2.2: Create `/api/metrics/[deviceId]/latest` endpoint
  - **Status**: ⏳ Not Started
  - **Method**: GET
  - **Output**: Most recent metrics from database

- [ ] 2.3: Create `/api/metrics/[deviceId]` historical endpoint
  - **Status**: ⏳ Not Started
  - **Method**: GET
  - **Query Params**: `?duration=1h|6h|24h`
  - **Output**: Time-series data for charts

- [ ] 2.4: Implement auto-cleanup cron job
  - **Status**: ⏳ Not Started
  - **Logic**: Delete metrics older than 24 hours
  - **Trigger**: Daily or on-demand

- [ ] 2.5: Add error handling and timeouts
  - **Status**: ⏳ Not Started
  - **Timeout**: 5 seconds for SSH commands
  - **Fallback**: Return cached metrics on failure

#### Deliverables
- ✅ All API endpoints functional
- ✅ Historical queries optimized
- ✅ Auto-cleanup working
- ✅ Error handling tested

#### Blockers / Notes
- *None yet*

---

### **Phase 3: Frontend Dashboard**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 4-6 hours

#### Tasks
- [ ] 3.1: Create `components/metrics/` directory structure
  - **Status**: ⏳ Not Started
  - **Files**:
    - `MetricsPanel.tsx` (main container)
    - `MetricCard.tsx` (individual metric display)
    - `MetricGauge.tsx` (circular progress indicator)
    - `MetricChart.tsx` (historical line chart)
    - `MetricsPoller.tsx` (real-time data handler)

- [ ] 3.2: Build MetricsPanel with 4-card grid layout
  - **Status**: ⏳ Not Started
  - **Cards**: CPU, RAM, GPU, Network
  - **Layout**: Responsive grid (2x2 on desktop, 1 column on mobile)

- [ ] 3.3: Implement real-time polling system
  - **Status**: ⏳ Not Started
  - **Interval**: 5 seconds
  - **Logic**: Auto-pause when tab inactive

- [ ] 3.4: Create circular gauge components (btop-style)
  - **Status**: ⏳ Not Started
  - **Library**: Custom CSS or recharts
  - **Colors**: Green (<50%), Yellow (50-80%), Red (>80%)

- [ ] 3.5: Add historical chart view with Recharts
  - **Status**: ⏳ Not Started
  - **Features**: Line charts, tooltips, zoom controls
  - **Data**: Last 24 hours with 5-minute resolution

- [ ] 3.6: Style with btop-inspired dark theme
  - **Status**: ⏳ Not Started
  - **Theme**: Dark background, neon accents, monospace fonts
  - **Consistency**: Match existing app design

- [ ] 3.7: Add per-device metrics selector
  - **Status**: ⏳ Not Started
  - **UI**: Dropdown to switch between devices
  - **State**: Remember last selected device

#### Deliverables
- ✅ Metrics dashboard fully functional
- ✅ Real-time updates working
- ✅ Historical charts displaying correctly
- ✅ Responsive design tested
- ✅ btop-style aesthetics implemented

#### Blockers / Notes
- *None yet*

---

### **Phase 4: Homebridge Integration**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 3-4 hours

#### Tasks
- [ ] 4.1: Install Homebridge on Raspberry Pi
  - **Status**: ⏳ Not Started
  - **Commands**:
    ```bash
    sudo npm install -g --unsafe-perm homebridge homebridge-config-ui-x
    sudo hb-service install --user pi
    ```
  - **Validation**: Access UI at `http://raspberrypi.local:8581`

- [ ] 4.2: Create `homebridge-pc-monitor` plugin structure
  - **Status**: ⏳ Not Started
  - **Directory**: `homebridge-pc-monitor/`
  - **Files**:
    - `package.json`
    - `index.js` (main plugin)
    - `config.schema.json` (Homebridge UI config)
    - `accessories/` (CPUSensor, RAMSensor, GPUSensor, NetworkSensor)

- [ ] 4.3: Implement sensor accessories
  - **Status**: ⏳ Not Started
  - **Mapping**:
    - CPU → Temperature Sensor (0-100°C = 0-100% usage)
    - RAM → Humidity Sensor (0-100% humidity = 0-100% usage)
    - GPU → Temperature Sensor (labeled "GPU")
    - Network → Light Sensor (0-100 lux = bandwidth usage)

- [ ] 4.4: Configure API polling logic
  - **Status**: ⏳ Not Started
  - **Endpoint**: `/api/metrics/:deviceId/latest`
  - **Interval**: 10-30 seconds (configurable)
  - **Auth**: JWT token via config

- [ ] 4.5: Test in Apple Home app
  - **Status**: ⏳ Not Started
  - **Validation**: Sensors appear, values update, automations work

- [ ] 4.6: Publish plugin to npm (optional)
  - **Status**: ⏳ Not Started
  - **Package**: `homebridge-pc-monitor`
  - **Docs**: README with setup instructions

#### Deliverables
- ✅ Homebridge installed and running
- ✅ Custom plugin functional
- ✅ Sensors visible in Apple Home
- ✅ Real-time updates working
- ✅ Documentation published

#### Blockers / Notes
- **Note**: HomeKit lacks native CPU/RAM sensors, using temperature/humidity as workaround
- **Limitation**: No historical graphs in Apple Home (iOS platform limitation)

---

### **Phase 5: Testing & Optimization**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 2-3 hours

#### Tasks
- [ ] 5.1: Performance testing
  - **Status**: ⏳ Not Started
  - **Metrics**: SSH latency, database query time, frontend render time
  - **Target**: <500ms total collection time, <50ms DB writes

- [ ] 5.2: Load testing
  - **Status**: ⏳ Not Started
  - **Scenario**: Multiple devices, concurrent requests
  - **Validation**: No database locks, stable memory usage

- [ ] 5.3: Error scenario testing
  - **Status**: ⏳ Not Started
  - **Cases**: SSH failure, GPU unavailable, network timeout
  - **Validation**: Graceful fallbacks, cached data served

- [ ] 5.4: Cross-browser testing
  - **Status**: ⏳ Not Started
  - **Browsers**: Chrome, Firefox, Safari (iOS)
  - **Validation**: Charts render, polling works, responsive layout

- [ ] 5.5: Database optimization
  - **Status**: ⏳ Not Started
  - **Tasks**: Index tuning, query optimization, cleanup verification
  - **Target**: <50MB database size with 24h retention

#### Deliverables
- ✅ All performance targets met
- ✅ Error handling verified
- ✅ Cross-browser compatibility confirmed
- ✅ Database optimized

#### Blockers / Notes
- *None yet*

---

### **Phase 6: Documentation**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 2 hours

#### Tasks
- [ ] 6.1: Update CLAUDE.md with new features
  - **Status**: ⏳ Not Started
  - **Sections**: Architecture, API routes, components

- [ ] 6.2: Write user guide for metrics dashboard
  - **Status**: ⏳ Not Started
  - **Topics**: Interpreting metrics, historical charts, troubleshooting

- [ ] 6.3: Document Homebridge setup
  - **Status**: ⏳ Not Started
  - **Sections**: Installation, configuration, Apple Home setup

- [ ] 6.4: Create PowerShell script examples
  - **Status**: ⏳ Not Started
  - **Purpose**: Manual metrics collection for testing

- [ ] 6.5: Add inline code documentation
  - **Status**: ⏳ Not Started
  - **Files**: `lib/metrics.ts`, API routes, React components

#### Deliverables
- ✅ CLAUDE.md updated
- ✅ User documentation complete
- ✅ Homebridge setup guide published
- ✅ Code fully documented

#### Blockers / Notes
- *None yet*

---

### **Phase 7: Deployment**
**Status**: ⏳ Not Started | **Progress**: 0% | **Est. Time**: 1-2 hours

#### Tasks
- [ ] 7.1: Deploy updated Next.js app to Raspberry Pi
  - **Status**: ⏳ Not Started
  - **Steps**: Build production bundle, restart service

- [ ] 7.2: Install Homebridge plugin
  - **Status**: ⏳ Not Started
  - **Method**: Local install or npm publish + install

- [ ] 7.3: Configure Homebridge with device credentials
  - **Status**: ⏳ Not Started
  - **Config**: Add PC devices, set API URL, polling interval

- [ ] 7.4: Verify end-to-end functionality
  - **Status**: ⏳ Not Started
  - **Tests**: Web dashboard, Apple Home, SSH connectivity

- [ ] 7.5: Monitor for 24 hours
  - **Status**: ⏳ Not Started
  - **Checks**: Memory usage, database size, error logs

#### Deliverables
- ✅ Production deployment complete
- ✅ Homebridge integrated
- ✅ 24-hour stability confirmed
- ✅ Monitoring dashboards operational

#### Blockers / Notes
- *None yet*

---

## 🧪 Technical Specifications

### **Database Schema**
```sql
CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  cpu_percent REAL,                -- 0-100
  ram_used_gb REAL,                -- GB
  ram_total_gb REAL,               -- GB
  ram_percent REAL,                -- 0-100
  gpu_percent REAL,                -- 0-100 (null if unavailable)
  gpu_memory_used_mb INTEGER,      -- MB
  gpu_memory_total_mb INTEGER,     -- MB
  network_rx_mbps REAL,            -- Megabits per second
  network_tx_mbps REAL,            -- Megabits per second
  timestamp INTEGER NOT NULL,      -- Unix timestamp
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_device_time
ON system_metrics(device_id, timestamp DESC);
```

### **PowerShell Commands**
```powershell
# CPU Usage (%)
(Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue

# RAM Usage
$os = Get-CimInstance Win32_OperatingSystem;
[PSCustomObject]@{
  TotalGB = [math]::Round($os.TotalVisibleMemorySize/1MB, 2);
  FreeGB = [math]::Round($os.FreePhysicalMemory/1MB, 2);
  UsedPercent = [math]::Round((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize) * 100, 2)
}

# GPU Usage (NVIDIA only)
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits

# Network Usage (delta calculation required)
Get-NetAdapterStatistics | Where-Object {$_.Name -notlike '*Loopback*'} | Select-Object Name, ReceivedBytes, SentBytes
```

### **API Endpoints**

#### `POST /api/metrics/collect`
**Request**:
```json
{
  "deviceId": 1
}
```

**Response**:
```json
{
  "deviceId": 1,
  "metrics": {
    "cpu": 45.2,
    "ram": { "used": 12.5, "total": 32.0, "percent": 39.1 },
    "gpu": { "usage": 78.5, "memoryUsed": 6144, "memoryTotal": 8192 },
    "network": { "rxMbps": 125.3, "txMbps": 45.2 }
  },
  "timestamp": 1729012345,
  "collectedAt": "2025-10-15T14:25:45Z"
}
```

#### `GET /api/metrics/[deviceId]/latest`
**Response**: Same as collect endpoint

#### `GET /api/metrics/[deviceId]?duration=24h`
**Response**:
```json
{
  "deviceId": 1,
  "duration": "24h",
  "dataPoints": 288,
  "metrics": {
    "cpu": [
      { "timestamp": 1729012345, "value": 45.2 },
      { "timestamp": 1729012645, "value": 47.1 },
      ...
    ],
    "ram": [...],
    "gpu": [...],
    "network": { "rx": [...], "tx": [...] }
  }
}
```

### **Homebridge Plugin Configuration**
```json
{
  "platforms": [
    {
      "platform": "PCMonitor",
      "name": "PC Monitor",
      "apiUrl": "http://localhost:3000/api/metrics",
      "jwtToken": "your-jwt-token-here",
      "refreshInterval": 15,
      "devices": [
        {
          "id": 1,
          "name": "Gaming PC",
          "enableCPU": true,
          "enableRAM": true,
          "enableGPU": true,
          "enableNetwork": true
        }
      ]
    }
  ]
}
```

---

## 📈 Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| SSH Collection Time | <500ms | TBD | ⏳ |
| Database Write Time | <50ms | TBD | ⏳ |
| API Response Time | <200ms | TBD | ⏳ |
| Frontend Render Time | <100ms | TBD | ⏳ |
| Database Size (24h) | <50MB | TBD | ⏳ |
| Memory Usage (Raspberry Pi) | <200MB | TBD | ⏳ |
| Homebridge Polling Interval | 10-30s | TBD | ⏳ |

---

## ⚠️ Known Limitations & Considerations

### **Windows PC Requirements**
- OpenSSH server must be running
- PowerShell 5.1+ required
- NVIDIA GPU required for GPU metrics (or alternative AMD/Intel commands)
- Network adapter must support statistics (`Get-NetAdapterStatistics`)

### **Apple Home Integration**
- HomeKit lacks native CPU/RAM sensors (using temperature/humidity workaround)
- No historical charts in Home app (iOS platform limitation)
- Sensor updates limited by HomeKit refresh rate (~10-30 seconds)
- Automations possible but limited to threshold triggers

### **Database**
- SQLite WAL mode required for concurrent access
- 24-hour retention policy (configurable but impacts disk space)
- No built-in aggregation (5-minute resolution for charts)

### **Security**
- SSH credentials stored in plaintext (device table)
- JWT token required for Homebridge API access
- Designed for local network only (DO NOT expose to internet)

---

## 🔄 Progress Tracking Instructions

### **How to Update This Document**

1. **Update Phase Status**:
   - Change milestone status: ⏳ → 🔄 → ✅ → ❌ → ⚠️
   - Update progress percentage
   - Set target/completion dates

2. **Update Task Status**:
   - Check off completed tasks: `- [ ]` → `- [x]`
   - Update task status in description
   - Add notes/blockers in "Blockers / Notes" section

3. **Log Issues/Blockers**:
   - Add to "Blockers / Notes" under relevant phase
   - Include date, description, and resolution (if applicable)

4. **Update Performance Metrics**:
   - Record actual measurements in "Current" column
   - Update status: ⏳ → ✅ (met target) or ❌ (needs work)

5. **Document Decisions**:
   - Add to "Decision Log" section below
   - Include date, decision, rationale, alternatives considered

---

## 📝 Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2025-10-15 | Use SSH + PowerShell for metrics collection | Leverages existing SSH infrastructure, no additional software on Windows | Windows agent service (requires installation) |
| 2025-10-15 | 24-hour retention policy | Balances storage vs. historical data needs | 7-day retention (excessive for use case) |
| 2025-10-15 | Use temperature/humidity sensors in HomeKit | HomeKit lacks native CPU/RAM sensors | Custom HomeKit accessory type (complex, poor compatibility) |
| TBD | | | |

---

## 🐛 Issues & Blockers

### **Current Blockers**
*None - project not started*

### **Resolved Issues**
*None yet*

---

## 📚 References & Resources

### **Documentation**
- [PowerShell Performance Counters](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-counter)
- [NVIDIA-SMI Documentation](https://developer.nvidia.com/nvidia-system-management-interface)
- [Homebridge Plugin Development](https://developers.homebridge.io/)
- [HomeKit Accessory Protocol (HAP)](https://developer.apple.com/homekit/)

### **Libraries**
- [node-ssh](https://github.com/steelbrain/node-ssh) - SSH client for Node.js
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite for Node.js
- [recharts](https://recharts.org/) - React charting library
- [homebridge](https://homebridge.io/) - HomeKit bridge for non-Apple devices

### **Related Files**
- `lib/db.ts` - Database layer
- `lib/auth.ts` - Authentication utilities
- `app/api/status/route.ts` - Device status checking (reference implementation)
- `CLAUDE.md` - Project documentation

---

## 🎯 Next Steps

1. **Review this plan** with stakeholders
2. **Set target dates** for each phase
3. **Begin Phase 1**: Database schema + metrics collection service
4. **Update this document** as work progresses
5. **Schedule regular progress reviews** (weekly recommended)

---

## 📞 Contact & Support

**Project Maintainer**: TBD
**Repository**: /Users/hvnguyen/Projects/rpi-remote-wol
**Homebridge Logs**: `sudo journalctl -u homebridge -f --no-pager`

---

**Document Version**: 1.0
**Last Updated By**: Claude Code
**Change History**:
- 2025-10-15: Initial document creation with full implementation plan
