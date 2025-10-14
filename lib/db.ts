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
    `);

    // Migration: Add ip_address column if it doesn't exist
    try {
      const columns = db.pragma('table_info(devices)') as Array<{ name: string }>;
      const hasIpAddress = columns.some(col => col.name === 'ip_address');
      const hasSshUsername = columns.some(col => col.name === 'ssh_username');
      const hasSshPassword = columns.some(col => col.name === 'ssh_password');

      if (!hasIpAddress) {
        db.exec('ALTER TABLE devices ADD COLUMN ip_address TEXT');
      }
      if (!hasSshUsername) {
        db.exec('ALTER TABLE devices ADD COLUMN ssh_username TEXT');
      }
      if (!hasSshPassword) {
        db.exec('ALTER TABLE devices ADD COLUMN ssh_password TEXT');
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

// Export close function for cleanup
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
