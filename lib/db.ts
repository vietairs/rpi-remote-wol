import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'devices.db');

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

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

// Prepared statements
const getAllDevices = db.prepare('SELECT * FROM devices ORDER BY name ASC');

const getDeviceById = db.prepare('SELECT * FROM devices WHERE id = ?');

const getDeviceByMac = db.prepare('SELECT * FROM devices WHERE mac_address = ?');

const insertDevice = db.prepare(`
  INSERT INTO devices (name, mac_address)
  VALUES (@name, @mac_address)
`);

const updateDevice = db.prepare(`
  UPDATE devices
  SET name = @name, mac_address = @mac_address, updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

const deleteDevice = db.prepare('DELETE FROM devices WHERE id = ?');

// Export database operations
export const deviceDb = {
  getAll: () => getAllDevices.all() as Device[],

  getById: (id: number) => getDeviceById.get(id) as Device | undefined,

  getByMac: (macAddress: string) => getDeviceByMac.get(macAddress) as Device | undefined,

  create: (device: DeviceInput): Device => {
    const result = insertDevice.run(device);
    return getDeviceById.get(result.lastInsertRowid) as Device;
  },

  update: (id: number, device: DeviceInput): Device | undefined => {
    updateDevice.run({ id, ...device });
    return getDeviceById.get(id) as Device | undefined;
  },

  delete: (id: number): boolean => {
    const result = deleteDevice.run(id);
    return result.changes > 0;
  },
};

export default db;
