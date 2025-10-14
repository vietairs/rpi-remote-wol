import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Database helper functions for e2e tests
 *
 * These functions manage the test database lifecycle:
 * - Create clean test database
 * - Seed test data
 * - Clean up after tests
 */

const TEST_DB_DIR = path.join(process.cwd(), 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'devices.db');

/**
 * Set up a clean test database
 * Removes existing test database and creates fresh tables
 */
export async function setupTestDatabase(): Promise<void> {
  // Ensure data directory exists
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Create new database with schema
  const db = new Database(TEST_DB_PATH);

  // Enable WAL mode
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mac_address TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      ssh_username TEXT,
      ssh_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.close();
}

/**
 * Clean up test database
 * Removes test database file
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

/**
 * Clear all devices from database
 */
export async function clearAllDevices(): Promise<void> {
  const db = new Database(TEST_DB_PATH);
  db.exec('DELETE FROM devices');
  db.close();
}

/**
 * Clear all users from database
 */
export async function clearAllUsers(): Promise<void> {
  const db = new Database(TEST_DB_PATH);
  db.exec('DELETE FROM users');
  db.close();
}

/**
 * Reset database to clean state (clear all data)
 */
export async function resetDatabase(): Promise<void> {
  await clearAllDevices();
  await clearAllUsers();
}

/**
 * Get device count from database
 */
export async function getDeviceCount(): Promise<number> {
  const db = new Database(TEST_DB_PATH);
  const result = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };
  db.close();
  return result.count;
}

/**
 * Get user count from database
 */
export async function getUserCount(): Promise<number> {
  const db = new Database(TEST_DB_PATH);
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  db.close();
  return result.count;
}

/**
 * Check if database exists
 */
export function databaseExists(): boolean {
  return fs.existsSync(TEST_DB_PATH);
}
