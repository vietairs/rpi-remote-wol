/**
 * Notification Service
 * Manages in-app notifications for power threshold alerts and system events
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Notification {
  id: number;
  user_id: number;
  device_id: number | null;
  type: string; // 'power_threshold' | 'collection_failure' | 'device_offline'
  title: string;
  message: string;
  severity: string; // 'info' | 'warning' | 'error'
  read: number; // 0 or 1
  created_at: string;
}

export interface NotificationInput {
  user_id: number;
  device_id?: number | null;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

let notificationDb: Database.Database | null = null;

function getNotificationDb(): Database.Database {
  if (!notificationDb) {
    const dbDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dbDir, 'devices.db');

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    notificationDb = new Database(dbPath, { timeout: 5000 });
    notificationDb.pragma('journal_mode = WAL');
    notificationDb.pragma('busy_timeout = 5000');
    notificationDb.pragma('foreign_keys = ON');

    // Create notifications table
    notificationDb.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id INTEGER,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_read
      ON notifications(user_id, read, created_at DESC);
    `);
  }

  return notificationDb;
}

export const notificationService = {
  /**
   * Create a new notification
   */
  create: (input: NotificationInput): Notification => {
    const database = getNotificationDb();
    const stmt = database.prepare(`
      INSERT INTO notifications (user_id, device_id, type, title, message, severity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.user_id,
      input.device_id || null,
      input.type,
      input.title,
      input.message,
      input.severity
    );

    const getStmt = database.prepare('SELECT * FROM notifications WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as Notification;
  },

  /**
   * Get all notifications for a user
   */
  getForUser: (userId: number, unreadOnly: boolean = false, limit: number = 50): Notification[] => {
    const database = getNotificationDb();

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];

    if (unreadOnly) {
      query += ' AND read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = database.prepare(query);
    return stmt.all(...params) as Notification[];
  },

  /**
   * Get unread count for a user
   */
  getUnreadCount: (userId: number): number => {
    const database = getNotificationDb();
    const stmt = database.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0');
    const result = stmt.get(userId) as { count: number };
    return result.count;
  },

  /**
   * Mark notification as read
   */
  markAsRead: (notificationId: number): boolean => {
    const database = getNotificationDb();
    const stmt = database.prepare('UPDATE notifications SET read = 1 WHERE id = ?');
    const result = stmt.run(notificationId);
    return result.changes > 0;
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: (userId: number): number => {
    const database = getNotificationDb();
    const stmt = database.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0');
    const result = stmt.run(userId);
    return result.changes;
  },

  /**
   * Delete a notification
   */
  delete: (notificationId: number): boolean => {
    const database = getNotificationDb();
    const stmt = database.prepare('DELETE FROM notifications WHERE id = ?');
    const result = stmt.run(notificationId);
    return result.changes > 0;
  },

  /**
   * Delete old read notifications (cleanup)
   */
  deleteOldRead: (days: number = 7): number => {
    const database = getNotificationDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const stmt = database.prepare(
      'DELETE FROM notifications WHERE read = 1 AND created_at < ?'
    );
    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  },

  /**
   * Check if power threshold is exceeded and create notification
   */
  checkPowerThreshold: (
    userId: number,
    deviceId: number,
    deviceName: string,
    currentWatts: number,
    thresholdWatts: number
  ): Notification | null => {
    if (currentWatts <= thresholdWatts) {
      return null;
    }

    const database = getNotificationDb();

    // Check if similar notification exists in last hour (prevent spam)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const existingStmt = database.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND device_id = ? AND type = 'power_threshold'
      AND created_at > ?
      LIMIT 1
    `);

    const existing = existingStmt.get(userId, deviceId, oneHourAgo.toISOString());

    if (existing) {
      // Don't create duplicate notification within 1 hour
      return null;
    }

    // Create new threshold alert
    return notificationService.create({
      user_id: userId,
      device_id: deviceId,
      type: 'power_threshold',
      title: `High Power Usage: ${deviceName}`,
      message: `Power consumption (${currentWatts.toFixed(1)}W) exceeded threshold (${thresholdWatts.toFixed(1)}W)`,
      severity: 'warning',
    });
  },

  /**
   * Create collection failure notification
   */
  notifyCollectionFailure: (
    userId: number,
    deviceId: number,
    deviceName: string,
    errorMessage: string
  ): Notification => {
    return notificationService.create({
      user_id: userId,
      device_id: deviceId,
      type: 'collection_failure',
      title: `Metrics Collection Failed: ${deviceName}`,
      message: `Failed to collect metrics: ${errorMessage}`,
      severity: 'error',
    });
  },

  /**
   * Create device offline notification
   */
  notifyDeviceOffline: (
    userId: number,
    deviceId: number,
    deviceName: string
  ): Notification => {
    const database = getNotificationDb();

    // Check if similar notification exists in last 6 hours
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const existingStmt = database.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND device_id = ? AND type = 'device_offline'
      AND created_at > ?
      LIMIT 1
    `);

    const existing = existingStmt.get(userId, deviceId, sixHoursAgo.toISOString());

    if (existing) {
      // Return existing notification to avoid spam
      const getStmt = database.prepare('SELECT * FROM notifications WHERE id = ?');
      return getStmt.get(existing.id) as Notification;
    }

    return notificationService.create({
      user_id: userId,
      device_id: deviceId,
      type: 'device_offline',
      title: `Device Offline: ${deviceName}`,
      message: `${deviceName} is no longer responding`,
      severity: 'info',
    });
  },
};

export function closeNotificationDb(): void {
  if (notificationDb) {
    notificationDb.close();
    notificationDb = null;
  }
}
