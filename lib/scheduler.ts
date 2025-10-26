import { deviceDb, metricsDb, userPreferencesDb, userDb, type Device } from './db';
import { collectMetrics } from './metrics';
import { collectionHistoryDb } from './db-collection-history';
import { notificationService } from './notification-service';

/**
 * Background Metrics Collection Scheduler
 *
 * Runs independently of UI, collecting metrics from online devices at regular intervals.
 * Designed for 24/7 monitoring when application is running.
 */

interface SchedulerConfig {
  enabled: boolean;
  intervalMs: number; // Collection interval in milliseconds
  maxConcurrent: number; // Max devices to collect from simultaneously
}

interface SchedulerState {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  totalCollections: number;
  successCount: number;
  failureCount: number;
  currentDevices: number[];
}

class MetricsScheduler {
  private config: SchedulerConfig;
  private state: SchedulerState;
  private timerId: NodeJS.Timeout | null = null;
  private isCollecting = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.state = {
      isRunning: false,
      lastRun: null,
      nextRun: null,
      totalCollections: 0,
      successCount: 0,
      failureCount: 0,
      currentDevices: [],
    };
  }

  /**
   * Start the background scheduler
   */
  start(): void {
    if (this.state.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[Scheduler] Disabled in config');
      return;
    }

    console.log(`[Scheduler] Starting with interval: ${this.config.intervalMs / 1000}s`);
    this.state.isRunning = true;
    this.scheduleNext();
  }

  /**
   * Stop the background scheduler
   */
  stop(): void {
    if (!this.state.isRunning) {
      console.log('[Scheduler] Already stopped');
      return;
    }

    console.log('[Scheduler] Stopping...');
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.state.isRunning = false;
    this.state.nextRun = null;
  }

  /**
   * Force immediate collection cycle
   */
  async runNow(): Promise<void> {
    if (this.isCollecting) {
      console.log('[Scheduler] Collection already in progress');
      return;
    }

    console.log('[Scheduler] Manual collection triggered');
    await this.collectFromAllDevices();
  }

  /**
   * Schedule next collection cycle
   */
  private scheduleNext(): void {
    if (!this.state.isRunning) return;

    const nextRunTime = new Date(Date.now() + this.config.intervalMs);
    this.state.nextRun = nextRunTime;

    this.timerId = setTimeout(() => {
      this.collectFromAllDevices().then(() => {
        this.scheduleNext(); // Schedule next cycle
      });
    }, this.config.intervalMs);

    console.log(`[Scheduler] Next run scheduled for: ${nextRunTime.toISOString()}`);
  }

  /**
   * Collect metrics from all eligible devices
   */
  private async collectFromAllDevices(): Promise<void> {
    if (this.isCollecting) {
      console.log('[Scheduler] Collection already in progress, skipping');
      return;
    }

    this.isCollecting = true;
    this.state.lastRun = new Date();
    this.state.totalCollections++;

    try {
      // Get all devices with IP address and SSH credentials
      const devices = deviceDb.getAll().filter(
        (d) => d.ip_address && d.ssh_username && d.ssh_password
      );

      console.log(`[Scheduler] Collecting from ${devices.length} devices`);

      if (devices.length === 0) {
        console.log('[Scheduler] No devices configured for collection');
        return;
      }

      this.state.currentDevices = devices.map((d) => d.id);

      // Check device status first (parallel)
      const statusChecks = await Promise.allSettled(
        devices.map(async (device) => {
          try {
            const response = await fetch(`http://localhost:3000/api/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ipAddress: device.ip_address }),
            });
            const data = await response.json();
            return { device, online: data.online };
          } catch (error) {
            console.error(`[Scheduler] Status check failed for ${device.name}:`, error);
            return { device, online: false };
          }
        })
      );

      // Filter to only online devices
      interface DeviceStatus { device: Device; online: boolean }
      const onlineDevices = statusChecks
        .filter((result): result is PromiseFulfilledResult<DeviceStatus> => result.status === 'fulfilled' && result.value.online)
        .map((result) => result.value.device);

      console.log(`[Scheduler] ${onlineDevices.length}/${devices.length} devices online`);

      if (onlineDevices.length === 0) {
        console.log('[Scheduler] No online devices to collect from');
        return;
      }

      // Collect metrics from online devices (respect concurrency limit)
      const batchSize = this.config.maxConcurrent;
      for (let i = 0; i < onlineDevices.length; i += batchSize) {
        const batch = onlineDevices.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (device) => {
            console.log(`[Scheduler] Collecting metrics from ${device.name}...`);
            const startTime = Date.now();
            const result = await collectMetrics(device);
            const collectionTime = Date.now() - startTime;

            if (result.success && result.metrics) {
              // Store metrics in database
              metricsDb.create({
                device_id: device.id,
                cpu_percent: result.metrics.cpu ?? undefined,
                ram_used_gb: result.metrics.ram.used ?? undefined,
                ram_total_gb: result.metrics.ram.total ?? undefined,
                ram_percent: result.metrics.ram.percent ?? undefined,
                gpu_percent: result.metrics.gpu?.usage ?? undefined,
                gpu_memory_used_mb: result.metrics.gpu?.memoryUsed ?? undefined,
                gpu_memory_total_mb: result.metrics.gpu?.memoryTotal ?? undefined,
                network_rx_mbps: result.metrics.network?.rxMbps ?? undefined,
                network_tx_mbps: result.metrics.network?.txMbps ?? undefined,
                power_consumption_w: result.metrics.power?.watts ?? undefined,
                power_estimated: result.metrics.power?.estimated ?? false,
                timestamp: result.timestamp,
              });

              // Log success
              collectionHistoryDb.create({
                device_id: device.id,
                success: true,
                collection_time_ms: collectionTime,
                triggered_by: 'scheduler',
              });

              // Check power threshold and create notification if needed
              try {
                // Get all users to check their preferences
                const users = userDb.getAll();
                for (const user of users) {
                  const prefs = userPreferencesDb.get(user.id);

                  // Only check if notifications are enabled and threshold is set
                  if (prefs?.enable_notifications && prefs.power_threshold_watts) {
                    const currentWatts = result.metrics.power?.watts;

                    if (currentWatts !== undefined && currentWatts !== null) {
                      const notification = notificationService.checkPowerThreshold(
                        user.id,
                        device.id,
                        device.name,
                        currentWatts,
                        prefs.power_threshold_watts
                      );

                      if (notification) {
                        console.log(`[Scheduler] 🔔 Power threshold alert created for ${device.name}: ${currentWatts.toFixed(1)}W > ${prefs.power_threshold_watts.toFixed(1)}W`);
                      }
                    }
                  }
                }
              } catch (notificationError) {
                console.error(`[Scheduler] Notification check failed for ${device.name}:`, notificationError);
                // Don't fail the collection if notification fails
              }

              this.state.successCount++;
              console.log(`[Scheduler] ✓ ${device.name} collected successfully (${collectionTime}ms)`);
              return { device, success: true };
            } else {
              // Log failure
              collectionHistoryDb.create({
                device_id: device.id,
                success: false,
                error_message: result.error,
                collection_time_ms: collectionTime,
                triggered_by: 'scheduler',
              });

              this.state.failureCount++;
              console.error(`[Scheduler] ✗ ${device.name} collection failed:`, result.error);
              return { device, success: false, error: result.error };
            }
          })
        );

        // Log batch results
        const batchSuccess = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Scheduler] Batch ${i / batchSize + 1}: ${batchSuccess}/${batch.length} successful`);
      }

      console.log(
        `[Scheduler] Collection cycle complete: ${this.state.successCount} success, ${this.state.failureCount} failures`
      );
    } catch (error) {
      console.error('[Scheduler] Collection cycle error:', error);
    } finally {
      this.isCollecting = false;
      this.state.currentDevices = [];
    }
  }

  /**
   * Get current scheduler state
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = this.state.isRunning;

    // Stop if running
    if (wasRunning) {
      this.stop();
    }

    // Update config
    this.config = { ...this.config, ...newConfig };

    // Restart if was running and still enabled
    if (wasRunning && this.config.enabled) {
      this.start();
    }

    console.log('[Scheduler] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }
}

// Singleton instance
let schedulerInstance: MetricsScheduler | null = null;

/**
 * Initialize the global scheduler with environment config
 */
export function initScheduler(): MetricsScheduler {
  if (schedulerInstance) {
    return schedulerInstance;
  }

  const config: SchedulerConfig = {
    enabled: process.env.ENABLE_BACKGROUND_METRICS === 'true',
    intervalMs: parseInt(process.env.BACKGROUND_METRICS_INTERVAL || '300000', 10), // Default: 5 minutes
    maxConcurrent: parseInt(process.env.BACKGROUND_METRICS_CONCURRENT || '3', 10), // Default: 3 devices
  };

  schedulerInstance = new MetricsScheduler(config);

  console.log('[Scheduler] Initialized with config:', config);

  return schedulerInstance;
}

/**
 * Get the global scheduler instance
 */
export function getScheduler(): MetricsScheduler | null {
  return schedulerInstance;
}

/**
 * Start the global scheduler (call once at app startup)
 */
export function startScheduler(): void {
  const scheduler = initScheduler();
  scheduler.start();
}

/**
 * Stop the global scheduler
 */
export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}
