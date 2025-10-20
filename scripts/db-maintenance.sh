#!/bin/bash
# Database maintenance script for PC Remote Wake
# This script should be run periodically via cron to prevent database lock accumulation
# Recommended: Run every 6 hours

# Configuration
BASE_URL="http://localhost:3000"
LOG_FILE="/tmp/pc-remote-wake-maintenance.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting database maintenance..."

# Perform WAL checkpoint
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"operation":"checkpoint"}' \
    -b "session=$SESSION_TOKEN" \
    "$BASE_URL/api/db-maintenance")

if [ $? -eq 0 ]; then
    log "Checkpoint response: $RESPONSE"
else
    log "ERROR: Checkpoint request failed"
    exit 1
fi

# Check if checkpoint was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    log "Database maintenance completed successfully"
    exit 0
else
    log "ERROR: Database maintenance failed"
    exit 1
fi
