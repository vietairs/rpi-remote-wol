/**
 * Collection History Database Operations
 * Tracks metrics collection success/failure rates for monitoring and debugging
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface CollectionHistoryEntry {
  id: number;
  device_id: number;
  success: number; // 0 or 1 (boolean)
  error_message: string | null;
  collection_time_ms: number;
  triggered_by: string; // 'scheduler' | 'manual' | 'ui'
  timestamp: number;
  created_at: string;
}

export interface CollectionHistoryInput {
  device_id: number;
  success: boolean;
  error_message?: string | null;
  collection_time_ms: number;
  triggered_by: 'scheduler' | 'manual' | 'ui';
}

let historyDb: Database.Database | null = null;

function getHistoryDb(): Database.Database {
  if (!historyDb) {
    const dbDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dbDir, 'devices.db');

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    historyDb = new Database(dbPath, { timeout: 5000 });
    historyDb.pragma('journal_mode = WAL');
    historyDb.pragma('busy_timeout = 5000');
    historyDb.pragma('foreign_keys = ON');

    // Create table if not exists
    historyDb.exec(`
      CREATE TABLE IF NOT EXISTS collection_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        collection_time_ms INTEGER NOT NULL,
        triggered_by TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_collection_history_device_time
      ON collection_history(device_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_collection_history_created
      ON collection_history(created_at DESC);
    `);
  }

  return historyDb;
}

export const collectionHistoryDb = {
  create: (input: CollectionHistoryInput): CollectionHistoryEntry => {
    const database = getHistoryDb();
    const stmt = database.prepare(`
      INSERT INTO collection_history (device_id, success, error_message, collection_time_ms, triggered_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const timestamp = Math.floor(Date.now() / 1000);
    const result = stmt.run(
      input.device_id,
      input.success ? 1 : 0,
      input.error_message || null,
      input.collection_time_ms,
      input.triggered_by,
      timestamp
    );

    const getStmt = database.prepare('SELECT * FROM collection_history WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as CollectionHistoryEntry;
  },

  getForDevice: (deviceId: number, limit: number = 100): CollectionHistoryEntry[] => {
    const database = getHistoryDb();
    const stmt = database.prepare(`
      SELECT * FROM collection_history
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(deviceId, limit) as CollectionHistoryEntry[];
  },

  getStats: (deviceId: number, hours: number = 24): {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgCollectionTime: number;
  } => {
    const database = getHistoryDb();
    const since = Math.floor(Date.now() / 1000) - hours * 3600;

    const stmt = database.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures,
        AVG(collection_time_ms) as avg_time
      FROM collection_history
      WHERE device_id = ? AND timestamp >= ?
    `);

    const result = stmt.get(deviceId, since) as {
      total: number;
      successes: number;
      failures: number;
      avg_time: number;
    };

    return {
      totalAttempts: result.total || 0,
      successCount: result.successes || 0,
      failureCount: result.failures || 0,
      successRate: result.total > 0 ? (result.successes / result.total) * 100 : 0,
      avgCollectionTime: Math.round(result.avg_time || 0),
    };
  },

  getAllStats: (hours: number = 24): {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
  } => {
    const database = getHistoryDb();
    const since = Math.floor(Date.now() / 1000) - hours * 3600;

    const stmt = database.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
      FROM collection_history
      WHERE timestamp >= ?
    `);

    const result = stmt.get(since) as {
      total: number;
      successes: number;
      failures: number;
    };

    return {
      totalAttempts: result.total || 0,
      successCount: result.successes || 0,
      failureCount: result.failures || 0,
      successRate: result.total > 0 ? (result.successes / result.total) * 100 : 0,
    };
  },

  deleteOlderThan: (days: number = 30): number => {
    const database = getHistoryDb();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 3600;

    const stmt = database.prepare('DELETE FROM collection_history WHERE timestamp < ?');
    const result = stmt.run(cutoffTimestamp);

    return result.changes;
  },
};

export function closeHistoryDb(): void {
  if (historyDb) {
    historyDb.close();
    historyDb = null;
  }
}
