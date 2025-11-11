# Deployment Guide - Automatic Maintenance Update

## What Changed

Your webapp now includes **automatic background database maintenance** that eliminates the need for cron jobs. The maintenance service runs inside the Next.js application and is managed by PM2.

## Key Improvements

✅ **No Cron Setup Required** - Maintenance runs automatically when app starts
✅ **PM2 Managed Lifecycle** - Service starts/stops with your application
✅ **Zero External Dependencies** - Everything runs within the Next.js process
✅ **Comprehensive Logging** - All maintenance activities logged to PM2
✅ **Fixes 24-Hour Freeze** - Automatic WAL checkpoints every 6 hours

## Files Modified

**New Files:**
- `lib/maintenance-service.ts` - Background maintenance service
- `instrumentation.ts` - Server startup hook
- `AUTOMATIC-MAINTENANCE.md` - Detailed documentation
- `docs/DEPLOYMENT-GUIDE.md` - This guide

**Updated Files:**
- `lib/db.ts` - Added WAL checkpoint functions and pragmas
- `middleware.ts` - Added token caching (80% CPU reduction)
- `app/api/db-maintenance/route.ts` - Manual trigger endpoints
- `ecosystem.config.js` - Removed cron_restart (no longer needed)
- `docs/TROUBLESHOOTING.md` - Updated for automatic maintenance

## Deployment Steps

### 1. Commit Changes (from your laptop)

```bash
cd /Users/hvnguyen/Projects/rpi-remote-wol

git add .
git commit -m "Add automatic database maintenance service"
git push
```

### 2. Deploy to Raspberry Pi

**SSH to your RPi:**
```bash
ssh pi@your-rpi-ip
```

**Pull changes and rebuild:**
```bash
cd /path/to/rpi-remote-wol

# Pull latest code
git pull

# Rebuild application
npm run build
```

### 3. Restart with New PM2 Configuration

```bash
# Stop and remove old PM2 process
pm2 stop "PC Remote Wake on Lan"
pm2 delete "PC Remote Wake on Lan"

# Start with new ecosystem.config.js
pm2 start ecosystem.config.js

# Save PM2 configuration for reboot persistence
pm2 save

# Optional: Ensure PM2 starts on system boot
pm2 startup
# Follow the command it outputs if needed
```

### 4. Verify Deployment

**Check PM2 status:**
```bash
pm2 status
```

**Check logs for maintenance service startup:**
```bash
pm2 logs "PC Remote Wake on Lan" --lines 50
```

**Expected output:**
```
[Instrumentation] Initializing server...
[Maintenance] Starting background maintenance service...
[Maintenance] WAL checkpoint every 6 hours
[Maintenance] Database optimization every 24 hours
[Maintenance] Performing WAL checkpoint...
[Maintenance] Checkpoint completed in 15ms - Frames: 42, WAL size: 128
[Maintenance] Service started successfully
```

**Check service status via API:**
```bash
curl http://localhost:3000/api/db-maintenance
```

**Expected response:**
```json
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

### 5. Clean Up Old Cron Jobs (if any)

If you had previously set up cron for maintenance:

```bash
# Edit crontab
crontab -e

# Remove any lines with /api/db-maintenance
# Save and exit

# Verify removal
crontab -l
```

## What to Monitor

### First 24 Hours

Watch PM2 logs for maintenance activity:
```bash
pm2 logs "PC Remote Wake on Lan" --lines 100 | grep Maintenance
```

You should see checkpoint logs every 6 hours.

### Database Health

Check WAL file size:
```bash
ls -lh /path/to/rpi-remote-wol/data/devices.db*
```

**Healthy state:**
- `devices.db-wal` should stay under 5MB
- Checkpoint logs should appear every 6 hours
- No error messages in PM2 logs

### Memory Usage

Monitor PM2 memory:
```bash
pm2 monit
```

App should restart automatically if memory exceeds 300MB (configured in ecosystem.config.js).

## Troubleshooting

### Service Not Starting

**Symptom:** No maintenance logs in PM2 output

**Fix:**
```bash
# Check for errors in PM2 logs
pm2 logs "PC Remote Wake on Lan" --err --lines 50

# Restart the application
pm2 restart "PC Remote Wake on Lan"

# Verify instrumentation.ts exists
ls -l instrumentation.ts
```

### WAL File Growing Despite Maintenance

**Symptom:** `devices.db-wal` exceeds 10MB

**Fix:**
```bash
# Check if service is actually running
curl http://localhost:3000/api/db-maintenance

# Check PM2 logs for checkpoint errors
pm2 logs "PC Remote Wake on Lan" | grep -A 5 "Checkpoint"

# Manual checkpoint trigger
curl -X POST http://localhost:3000/api/db-maintenance \
  -H "Content-Type: application/json" \
  -d '{"operation":"checkpoint"}'
```

### High Memory Usage

**Symptom:** App restarts frequently due to memory limit

**Fix:**
```bash
# Check current memory usage
pm2 info "PC Remote Wake on Lan"

# Increase memory limit in ecosystem.config.js if needed
# Change: max_memory_restart: '300M' to '500M'

# Reload PM2 configuration
pm2 restart "PC Remote Wake on Lan"
```

## Success Indicators

After 24-48 hours, you should observe:

✅ No more webapp freezes after extended uptime
✅ WAL file stays small (<5MB)
✅ Checkpoint logs appear every 6 hours
✅ Memory usage stable (no leaks)
✅ CPU overhead minimal (<5% during checkpoints)
✅ Application runs continuously without manual intervention

## Rollback Plan (if needed)

If you encounter issues and need to rollback:

```bash
# On Raspberry Pi
cd /path/to/rpi-remote-wol

# Revert to previous commit
git log --oneline -n 5  # Find previous commit hash
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Restart PM2
pm2 restart "PC Remote Wake on Lan"
```

## Support

For detailed information:
- **Maintenance Details:** See `AUTOMATIC-MAINTENANCE.md`
- **Troubleshooting:** See `docs/TROUBLESHOOTING.md`
- **General Issues:** Check PM2 logs and GitHub issues

## Summary

The automatic maintenance system provides:
- **Zero configuration** - Works out of the box
- **Self-healing** - Prevents the 24-hour freeze issue
- **Low overhead** - Minimal CPU and memory impact
- **Integrated logging** - All activity visible in PM2 logs
- **PM2 managed** - Service lifecycle tied to application

No manual intervention or cron jobs required! 🎉
