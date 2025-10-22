import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Device {
  id: number;
  name: string;
  mac_address: string;
  ip_address: string | null;
  ssh_username: string | null;
  ssh_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceInput {
  name: string;
  mac_address: string;
  ip_address?: string;
  ssh_username?: string;
  ssh_password?: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface UserInput {
  username: string;
  password_hash: string;
}

export interface ApiKey {
  id: number;
  key_hash: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by: number;
}

export interface ApiKeyInput {
  key_hash: string;
  name: string;
  created_by: number;
}

export interface SystemMetrics {
  id: number;
  device_id: number;
  cpu_percent: number | null;
  ram_used_gb: number | null;
  ram_total_gb: number | null;
  ram_percent: number | null;
  gpu_percent: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_total_mb: number | null;
  network_rx_mbps: number | null;
  network_tx_mbps: number | null;
  power_consumption_w: number | null;
  power_estimated: number | null;
  timestamp: number;
  created_at: string;
}

export interface SystemMetricsInput {
  device_id: number;
  cpu_percent?: number;
  ram_used_gb?: number;
  ram_total_gb?: number;
  ram_percent?: number;
  gpu_percent?: number;
  gpu_memory_used_mb?: number;
  gpu_memory_total_mb?: number;
  network_rx_mbps?: number;
  network_tx_mbps?: number;
  power_consumption_w?: number;
  power_estimated?: boolean;
  timestamp: number;
}

let db: Database.Database | null = null;

// Lazy initialization function
function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dbDir, 'devices.db');

    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database with timeout
    db = new Database(dbPath, {
      timeout: 5000,
    });

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');

    // Configure WAL checkpointing to prevent file growth
    // RESTART mode: checkpoint and reset WAL file to prevent accumulation
    db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages (~4MB)

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mac_address TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        created_by INTEGER NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        cpu_percent REAL,
        ram_used_gb REAL,
        ram_total_gb REAL,
        ram_percent REAL,
        gpu_percent REAL,
        gpu_memory_used_mb INTEGER,
        gpu_memory_total_mb INTEGER,
        network_rx_mbps REAL,
        network_tx_mbps REAL,
        power_consumption_w REAL,
        power_estimated INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_device_time
      ON system_metrics(device_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_metrics_device_created
      ON system_metrics(device_id, created_at DESC);
    `);

    // Migration: Add columns if they don't exist
    try {
      const deviceColumns = db.pragma('table_info(devices)') as Array<{ name: string }>;
      const hasIpAddress = deviceColumns.some(col => col.name === 'ip_address');
      const hasSshUsername = deviceColumns.some(col => col.name === 'ssh_username');
      const hasSshPassword = deviceColumns.some(col => col.name === 'ssh_password');

      if (!hasIpAddress) {
        db.exec('ALTER TABLE devices ADD COLUMN ip_address TEXT');
      }
      if (!hasSshUsername) {
        db.exec('ALTER TABLE devices ADD COLUMN ssh_username TEXT');
      }
      if (!hasSshPassword) {
        db.exec('ALTER TABLE devices ADD COLUMN ssh_password TEXT');
      }

      // Migration for system_metrics table
      const metricsColumns = db.pragma('table_info(system_metrics)') as Array<{ name: string }>;
      const hasPowerConsumption = metricsColumns.some(col => col.name === 'power_consumption_w');
      const hasPowerEstimated = metricsColumns.some(col => col.name === 'power_estimated');

      if (!hasPowerConsumption) {
        db.exec('ALTER TABLE system_metrics ADD COLUMN power_consumption_w REAL');
      }
      if (!hasPowerEstimated) {
        db.exec('ALTER TABLE system_metrics ADD COLUMN power_estimated INTEGER DEFAULT 0');
      }
    } catch (error) {
      // Column might already exist or table doesn't exist yet
      console.log('Migration check:', error);
    }
  }

  return db;
}

// Export database operations with lazy initialization
export const deviceDb = {
  getAll: (): Device[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM devices ORDER BY name ASC');
    return stmt.all() as Device[];
  },

  getById: (id: number): Device | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM devices WHERE id = ?');
    return stmt.get(id) as Device | undefined;
  },

  getByMac: (macAddress: string): Device | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM devices WHERE mac_address = ?');
    return stmt.get(macAddress) as Device | undefined;
  },

  create: (device: DeviceInput): Device => {
    const database = getDb();
    const insertStmt = database.prepare(`
      INSERT INTO devices (name, mac_address, ip_address, ssh_username, ssh_password)
      VALUES (@name, @mac_address, @ip_address, @ssh_username, @ssh_password)
    `);
    const result = insertStmt.run({
      name: device.name,
      mac_address: device.mac_address,
      ip_address: device.ip_address || null,
      ssh_username: device.ssh_username || null,
      ssh_password: device.ssh_password || null,
    });

    const getStmt = database.prepare('SELECT * FROM devices WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as Device;
  },

  update: (id: number, device: DeviceInput): Device | undefined => {
    const database = getDb();
    const updateStmt = database.prepare(`
      UPDATE devices
      SET name = @name, mac_address = @mac_address, ip_address = @ip_address,
          ssh_username = @ssh_username, ssh_password = @ssh_password, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    updateStmt.run({
      id,
      name: device.name,
      mac_address: device.mac_address,
      ip_address: device.ip_address || null,
      ssh_username: device.ssh_username || null,
      ssh_password: device.ssh_password || null,
    });

    const getStmt = database.prepare('SELECT * FROM devices WHERE id = ?');
    return getStmt.get(id) as Device | undefined;
  },

  delete: (id: number): boolean => {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM devices WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// User database operations
export const userDb = {
  getAll: (): User[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM users');
    return stmt.all() as User[];
  },

  getById: (id: number): User | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  },

  getByUsername: (username: string): User | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  },

  create: (user: UserInput): User => {
    const database = getDb();
    const insertStmt = database.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (@username, @password_hash)
    `);
    const result = insertStmt.run(user);

    const getStmt = database.prepare('SELECT * FROM users WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as User;
  },

  count: (): number => {
    const database = getDb();
    const stmt = database.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result.count;
  },
};

// API Key database operations
export const apiKeyDb = {
  getAll: (): ApiKey[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
    return stmt.all() as ApiKey[];
  },

  getAllForUser: (userId: number): Omit<ApiKey, 'key_hash'>[] => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT id, name, created_at, last_used_at, created_by
      FROM api_keys
      WHERE created_by = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as Omit<ApiKey, 'key_hash'>[];
  },

  getByHash: (keyHash: string): ApiKey | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
    return stmt.get(keyHash) as ApiKey | undefined;
  },

  create: (apiKey: ApiKeyInput): ApiKey => {
    const database = getDb();
    const insertStmt = database.prepare(`
      INSERT INTO api_keys (key_hash, name, created_by)
      VALUES (@key_hash, @name, @created_by)
    `);
    const result = insertStmt.run(apiKey);

    const getStmt = database.prepare('SELECT * FROM api_keys WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as ApiKey;
  },

  updateLastUsed: (keyHash: string): void => {
    const database = getDb();
    const stmt = database.prepare(`
      UPDATE api_keys
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE key_hash = ?
    `);
    stmt.run(keyHash);
  },

  deleteById: (id: number): boolean => {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM api_keys WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// System metrics database operations
export const metricsDb = {
  create: (metrics: SystemMetricsInput): SystemMetrics => {
    const database = getDb();
    const insertStmt = database.prepare(`
      INSERT INTO system_metrics (
        device_id, cpu_percent, ram_used_gb, ram_total_gb, ram_percent,
        gpu_percent, gpu_memory_used_mb, gpu_memory_total_mb,
        network_rx_mbps, network_tx_mbps, power_consumption_w, power_estimated, timestamp
      ) VALUES (
        @device_id, @cpu_percent, @ram_used_gb, @ram_total_gb, @ram_percent,
        @gpu_percent, @gpu_memory_used_mb, @gpu_memory_total_mb,
        @network_rx_mbps, @network_tx_mbps, @power_consumption_w, @power_estimated, @timestamp
      )
    `);
    const result = insertStmt.run({
      device_id: metrics.device_id,
      cpu_percent: metrics.cpu_percent ?? null,
      ram_used_gb: metrics.ram_used_gb ?? null,
      ram_total_gb: metrics.ram_total_gb ?? null,
      ram_percent: metrics.ram_percent ?? null,
      gpu_percent: metrics.gpu_percent ?? null,
      gpu_memory_used_mb: metrics.gpu_memory_used_mb ?? null,
      gpu_memory_total_mb: metrics.gpu_memory_total_mb ?? null,
      network_rx_mbps: metrics.network_rx_mbps ?? null,
      network_tx_mbps: metrics.network_tx_mbps ?? null,
      power_consumption_w: metrics.power_consumption_w ?? null,
      power_estimated: metrics.power_estimated ? 1 : 0,
      timestamp: metrics.timestamp,
    });

    const getStmt = database.prepare('SELECT * FROM system_metrics WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as SystemMetrics;
  },

  getLatestForDevice: (deviceId: number): SystemMetrics | undefined => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT * FROM system_metrics
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get(deviceId) as SystemMetrics | undefined;
  },

  getHistoricalForDevice: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): SystemMetrics[] => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT * FROM system_metrics
      WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(deviceId, startTimestamp, endTimestamp) as SystemMetrics[];
  },

  deleteOlderThan: (timestamp: number): number => {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM system_metrics WHERE timestamp < ?');
    const result = stmt.run(timestamp);
    return result.changes;
  },

  countForDevice: (deviceId: number): number => {
    const database = getDb();
    const stmt = database.prepare('SELECT COUNT(*) as count FROM system_metrics WHERE device_id = ?');
    const result = stmt.get(deviceId) as { count: number };
    return result.count;
  },

  /**
   * Calculate energy consumption (kWh) for a device over a time period
   * Uses trapezoidal integration: energy = sum((p1 + p2) / 2 * dt) where dt is in hours
   */
  getEnergyConsumption: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): { energyKwh: number; dataPoints: number } => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT power_consumption_w, timestamp
      FROM system_metrics
      WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
      AND power_consumption_w IS NOT NULL
      ORDER BY timestamp ASC
    `);

    const metrics = stmt.all(deviceId, startTimestamp, endTimestamp) as Array<{
      power_consumption_w: number;
      timestamp: number;
    }>;

    if (metrics.length < 2) {
      return { energyKwh: 0, dataPoints: metrics.length };
    }

    // Trapezoidal integration to calculate energy consumption
    let totalEnergyWh = 0;

    for (let i = 0; i < metrics.length - 1; i++) {
      const p1 = metrics[i].power_consumption_w;
      const p2 = metrics[i + 1].power_consumption_w;
      const dt = (metrics[i + 1].timestamp - metrics[i].timestamp) / 3600; // Convert to hours

      // Average power over interval * time
      const energyWh = ((p1 + p2) / 2) * dt;
      totalEnergyWh += energyWh;
    }

    return {
      energyKwh: totalEnergyWh / 1000, // Convert Wh to kWh
      dataPoints: metrics.length,
    };
  },

  /**
   * Get power consumption statistics for a time period
   */
  getPowerStats: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): {
    avgPowerW: number | null;
    maxPowerW: number | null;
    minPowerW: number | null;
    dataPoints: number;
  } => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT
        AVG(power_consumption_w) as avg_power,
        MAX(power_consumption_w) as max_power,
        MIN(power_consumption_w) as min_power,
        COUNT(*) as count
      FROM system_metrics
      WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
      AND power_consumption_w IS NOT NULL
    `);

    const result = stmt.get(deviceId, startTimestamp, endTimestamp) as {
      avg_power: number | null;
      max_power: number | null;
      min_power: number | null;
      count: number;
    };

    return {
      avgPowerW: result.avg_power,
      maxPowerW: result.max_power,
      minPowerW: result.min_power,
      dataPoints: result.count,
    };
  },

  /**
   * Aggregate metrics into hourly averages for a time period
   * Useful for reducing data points while maintaining trends
   * Returns averaged metrics grouped by hour
   */
  getHourlyAggregates: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): Array<{
    hour_timestamp: number;
    avg_cpu_percent: number | null;
    avg_ram_percent: number | null;
    avg_gpu_percent: number | null;
    avg_network_rx_mbps: number | null;
    avg_network_tx_mbps: number | null;
    avg_power_consumption_w: number | null;
    data_points: number;
  }> => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT
        (timestamp / 3600) * 3600 as hour_timestamp,
        AVG(cpu_percent) as avg_cpu_percent,
        AVG(ram_percent) as avg_ram_percent,
        AVG(gpu_percent) as avg_gpu_percent,
        AVG(network_rx_mbps) as avg_network_rx_mbps,
        AVG(network_tx_mbps) as avg_network_tx_mbps,
        AVG(power_consumption_w) as avg_power_consumption_w,
        COUNT(*) as data_points
      FROM system_metrics
      WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY hour_timestamp
      ORDER BY hour_timestamp ASC
    `);

    return stmt.all(deviceId, startTimestamp, endTimestamp) as Array<{
      hour_timestamp: number;
      avg_cpu_percent: number | null;
      avg_ram_percent: number | null;
      avg_gpu_percent: number | null;
      avg_network_rx_mbps: number | null;
      avg_network_tx_mbps: number | null;
      avg_power_consumption_w: number | null;
      data_points: number;
    }>;
  },

  /**
   * Aggregate metrics into daily averages for a time period
   * Useful for long-term historical trends (months/years)
   * Returns averaged metrics grouped by day
   */
  getDailyAggregates: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): Array<{
    day_timestamp: number;
    avg_cpu_percent: number | null;
    max_cpu_percent: number | null;
    avg_ram_percent: number | null;
    max_ram_percent: number | null;
    avg_gpu_percent: number | null;
    max_gpu_percent: number | null;
    avg_network_rx_mbps: number | null;
    avg_network_tx_mbps: number | null;
    avg_power_consumption_w: number | null;
    max_power_consumption_w: number | null;
    total_energy_kwh: number | null;
    data_points: number;
  }> => {
    const database = getDb();
    const stmt = database.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as day_timestamp,
        AVG(cpu_percent) as avg_cpu_percent,
        MAX(cpu_percent) as max_cpu_percent,
        AVG(ram_percent) as avg_ram_percent,
        MAX(ram_percent) as max_ram_percent,
        AVG(gpu_percent) as avg_gpu_percent,
        MAX(gpu_percent) as max_gpu_percent,
        AVG(network_rx_mbps) as avg_network_rx_mbps,
        AVG(network_tx_mbps) as avg_network_tx_mbps,
        AVG(power_consumption_w) as avg_power_consumption_w,
        MAX(power_consumption_w) as max_power_consumption_w,
        COUNT(*) as data_points
      FROM system_metrics
      WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY day_timestamp
      ORDER BY day_timestamp ASC
    `);

    const aggregates = stmt.all(deviceId, startTimestamp, endTimestamp) as Array<{
      day_timestamp: number;
      avg_cpu_percent: number | null;
      max_cpu_percent: number | null;
      avg_ram_percent: number | null;
      max_ram_percent: number | null;
      avg_gpu_percent: number | null;
      max_gpu_percent: number | null;
      avg_network_rx_mbps: number | null;
      avg_network_tx_mbps: number | null;
      avg_power_consumption_w: number | null;
      max_power_consumption_w: number | null;
      data_points: number;
    }>;

    // Calculate energy consumption for each day using detailed query
    return aggregates.map((agg) => {
      const dayStart = agg.day_timestamp;
      const dayEnd = dayStart + 86400;
      const { energyKwh } = metricsDb.getEnergyConsumption(deviceId, dayStart, dayEnd);

      return {
        ...agg,
        total_energy_kwh: energyKwh > 0 ? energyKwh : null,
      };
    });
  },

  /**
   * Get aggregated metrics with automatic resolution selection based on time range
   * - Less than 48 hours: Raw data (5-minute intervals)
   * - 48 hours to 30 days: Hourly aggregates
   * - More than 30 days: Daily aggregates
   */
  getAdaptiveAggregates: (
    deviceId: number,
    startTimestamp: number,
    endTimestamp: number
  ): {
    resolution: 'raw' | 'hourly' | 'daily';
    data: Array<any>;
  } => {
    const rangeSeconds = endTimestamp - startTimestamp;
    const twoDays = 2 * 24 * 3600;
    const thirtyDays = 30 * 24 * 3600;

    if (rangeSeconds <= twoDays) {
      // Less than 48 hours: return raw data
      return {
        resolution: 'raw',
        data: metricsDb.getHistoricalForDevice(deviceId, startTimestamp, endTimestamp),
      };
    } else if (rangeSeconds <= thirtyDays) {
      // 48 hours to 30 days: return hourly aggregates
      return {
        resolution: 'hourly',
        data: metricsDb.getHourlyAggregates(deviceId, startTimestamp, endTimestamp),
      };
    } else {
      // More than 30 days: return daily aggregates
      return {
        resolution: 'daily',
        data: metricsDb.getDailyAggregates(deviceId, startTimestamp, endTimestamp),
      };
    }
  },
};

// Export close function for cleanup
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Perform WAL checkpoint to optimize database file and prevent lock accumulation
 * Should be called periodically (e.g., via cron or scheduled task)
 * Returns number of WAL frames checkpointed
 */
export function checkpointWal(): { framesCheckpointed: number; framesInWal: number } {
  const database = getDb();

  // RESTART mode: checkpoint and reset WAL file
  const result = database.pragma('wal_checkpoint(RESTART)') as Array<{
    busy: number;
    log: number;
    checkpointed: number;
  }>;

  return {
    framesCheckpointed: result[0]?.checkpointed || 0,
    framesInWal: result[0]?.log || 0,
  };
}

/**
 * Optimize database by running VACUUM and ANALYZE
 * This should be run periodically during low-traffic periods
 * WARNING: VACUUM requires exclusive lock and can take time
 */
export function optimizeDb(): void {
  const database = getDb();

  // Run ANALYZE to update query planner statistics
  database.exec('ANALYZE');

  // Optionally run VACUUM to reclaim space (can be slow, use cautiously)
  // database.exec('VACUUM');
}

export default getDb;
