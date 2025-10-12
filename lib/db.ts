import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Device {
  id: number;
  name: string;
  mac_address: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceInput {
  name: string;
  mac_address: string;
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
      INSERT INTO devices (name, mac_address)
      VALUES (@name, @mac_address)
    `);
    const result = insertStmt.run(device);

    const getStmt = database.prepare('SELECT * FROM devices WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as Device;
  },

  update: (id: number, device: DeviceInput): Device | undefined => {
    const database = getDb();
    const updateStmt = database.prepare(`
      UPDATE devices
      SET name = @name, mac_address = @mac_address, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    updateStmt.run({ id, ...device });

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

// Export close function for cleanup
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
