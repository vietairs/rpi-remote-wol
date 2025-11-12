# Automatic Database Maintenance

## Overview

The application now includes **automatic background maintenance** that runs within the Next.js process. No external cron jobs or manual intervention needed!

## How It Works

### 1. Background Service (`lib/maintenance-service.ts`)
- Singleton service that manages periodic database maintenance
- Runs in the Node.js runtime (not Edge Runtime)
- Handles WAL checkpoints and database optimization automatically

### 2. Auto-Start on Server Launch (`instrumentation.ts`)
- Next.js 15 instrumentation hook starts the service when server boots
- Graceful shutdown handling to stop service cleanly
- Only runs in production/server mode, not in Edge Runtime

### 3. Maintenance Schedule

**WAL Checkpoints: Every 6 hours**
- Prevents database lock accumulation
- Keeps WAL file size small (<5MB typically)
- Logs checkpoint results for monitoring

**Database Optimization: Every 24 hours**
- Runs ANALYZE to update query planner statistics
- Improves query performance over time
- Low-impact operation that runs in background

### 4. Automatic Logging

The service logs all maintenance activities to PM2 logs:

```
[Instrumentation] Initializing server...
[Maintenance] Starting background maintenance service...
[Maintenance] WAL checkpoint every 6 hours
[Maintenance] Database optimization every 24 hours
[Maintenance] Performing WAL checkpoint...
[Maintenance] Checkpoint completed in 15ms - Frames: 42, WAL size: 128
```

**Warning alerts** if WAL grows too large:
```
[Maintenance] WARNING: WAL file has 12000 frames (>10K) - Consider more frequent checkpoints
```

## Monitoring

### Check Service Status

Via PM2 logs:
```bash
pm2 logs "PC Remote Wake on Lan" --lines 50 | grep Maintenance
```

Via API endpoint:
```bash
curl http://localhost:3000/api/db-maintenance

# Response:
{
  "success": true,
  "backgroundService": {
    "running": true,
    "checkpointIntervalHours": 6,
    "optimizeIntervalHours": 24
  },
  "database": {
    "walFrames": 128,
    "walFramesCheckpointed": 42
  },
  "timestamp": "2025-10-20T12:34:56.789Z"
}
```

### Manual Triggers (Optional)

If you need to force maintenance outside the schedule:

```bash
# Force checkpoint
curl -X POST http://localhost:3000/api/db-maintenance \
  -H "Content-Type: application/json" \
  -d '{"operation":"checkpoint"}'

# Force optimization
curl -X POST http://localhost:3000/api/db-maintenance \
  -H "Content-Type: application/json" \
  -d '{"operation":"optimize"}'
```

## Benefits

✅ **Zero Configuration**: Works out of the box, no cron setup needed
✅ **PM2 Managed**: Service lifecycle tied to app lifecycle
✅ **Automatic Recovery**: If PM2 restarts the app, maintenance service restarts too
✅ **Resource Efficient**: Low overhead, runs in same process as app
✅ **Logged Activity**: All maintenance logged for troubleshooting
✅ **No External Dependencies**: No cron, no separate processes, no API keys needed

## Technical Details

### Files Added/Modified

**New Files:**
- `lib/maintenance-service.ts` - Background maintenance service
- `instrumentation.ts` - Next.js server initialization hook
- `AUTOMATIC-MAINTENANCE.md` - This documentation

**Modified Files:**
- `app/api/db-maintenance/route.ts` - Updated to use maintenance service
- `lib/db.ts` - Added WAL checkpoint functions
- `ecosystem.config.js` - Removed cron_restart (no longer needed)
- `middleware.ts` - Added token caching to reduce CPU overhead

### Configuration Options

You can adjust intervals by modifying `instrumentation.ts`:

```typescript
// Default: checkpoint every 6 hours, optimize every 24 hours
maintenanceService.start(6, 24);

// More aggressive: checkpoint every 3 hours
maintenanceService.start(3, 24);

// Less frequent: checkpoint every 12 hours
maintenanceService.start(12, 48);
```

### Graceful Shutdown

The service properly handles shutdown signals:
- `SIGTERM` - PM2 graceful shutdown
- `SIGINT` - Ctrl+C in development

On shutdown, the service cleans up timers and closes cleanly.

## Troubleshooting

### Service Not Running

Check instrumentation logs:
```bash
pm2 logs "PC Remote Wake on Lan" --lines 100 | grep -E "(Instrumentation|Maintenance)"
```

Expected output on startup:
```
[Instrumentation] Initializing server...
[Maintenance] Starting background maintenance service...
[Maintenance] Service started successfully
```

### High WAL File Size

If `devices.db-wal` grows large despite automatic maintenance:

1. Check service is running (see above)
2. Trigger manual checkpoint
3. Check PM2 logs for errors
4. Consider more frequent checkpoints (modify `instrumentation.ts`)

### Service Keeps Restarting

Check PM2 configuration:
```bash
pm2 info "PC Remote Wake on Lan"
```

Ensure:
- `max_memory_restart: 300M` is not too low
- `min_uptime: 10s` allows service to stabilize
- No errors in PM2 error logs

## Migration from Cron

If you had a crontab entry for database maintenance:

```bash
# Remove old crontab entry
crontab -e
# Delete the line with curl to /api/db-maintenance

# Verify removal
crontab -l
```

The automatic service replaces cron completely.

## Performance Impact

**Minimal overhead:**
- Checkpoint: ~15-50ms every 6 hours
- Optimize: ~100-200ms every 24 hours
- Memory: ~1-2MB for service overhead
- CPU: Near-zero when idle

**Benefits far outweigh costs:**
- Prevents 24-hour freeze issue
- Keeps database healthy and fast
- Eliminates need for manual intervention
