import { checkpointWal, optimizeDb } from './db';

/**
 * Background database maintenance service
 * Automatically performs WAL checkpoints and optimization
 * to prevent database lock accumulation over time
 */
class MaintenanceService {
  private checkpointInterval: NodeJS.Timeout | null = null;
  private optimizeInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the maintenance service
   * @param checkpointIntervalHours - Hours between WAL checkpoints (default: 6)
   * @param optimizeIntervalHours - Hours between database optimization (default: 24)
   */
  start(checkpointIntervalHours = 6, optimizeIntervalHours = 24): void {
    if (this.isRunning) {
      console.log('[Maintenance] Service already running');
      return;
    }

    console.log('[Maintenance] Starting background maintenance service...');
    console.log(`[Maintenance] WAL checkpoint every ${checkpointIntervalHours} hours`);
    console.log(`[Maintenance] Database optimization every ${optimizeIntervalHours} hours`);

    // Perform initial checkpoint on startup
    this.performCheckpoint();

    // Schedule periodic checkpoints
    const checkpointMs = checkpointIntervalHours * 60 * 60 * 1000;
    this.checkpointInterval = setInterval(() => {
      this.performCheckpoint();
    }, checkpointMs);

    // Schedule periodic optimization (ANALYZE)
    const optimizeMs = optimizeIntervalHours * 60 * 60 * 1000;
    this.optimizeInterval = setInterval(() => {
      this.performOptimization();
    }, optimizeMs);

    this.isRunning = true;
    console.log('[Maintenance] Service started successfully');
  }

  /**
   * Stop the maintenance service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[Maintenance] Stopping background maintenance service...');

    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }

    if (this.optimizeInterval) {
      clearInterval(this.optimizeInterval);
      this.optimizeInterval = null;
    }

    this.isRunning = false;
    console.log('[Maintenance] Service stopped');
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Perform WAL checkpoint
   */
  private performCheckpoint(): void {
    try {
      const startTime = Date.now();
      console.log('[Maintenance] Performing WAL checkpoint...');

      const result = checkpointWal();

      const duration = Date.now() - startTime;
      console.log(
        `[Maintenance] Checkpoint completed in ${duration}ms - ` +
          `Frames: ${result.framesCheckpointed}, WAL size: ${result.framesInWal}`
      );

      // Log warning if WAL is growing too large
      if (result.framesInWal > 10000) {
        console.warn(
          `[Maintenance] WARNING: WAL file has ${result.framesInWal} frames (>10K) - ` +
            'Consider more frequent checkpoints'
        );
      }
    } catch (error) {
      console.error('[Maintenance] Checkpoint failed:', error);
    }
  }

  /**
   * Perform database optimization (ANALYZE)
   */
  private performOptimization(): void {
    try {
      const startTime = Date.now();
      console.log('[Maintenance] Performing database optimization...');

      optimizeDb();

      const duration = Date.now() - startTime;
      console.log(`[Maintenance] Optimization completed in ${duration}ms`);
    } catch (error) {
      console.error('[Maintenance] Optimization failed:', error);
    }
  }

  /**
   * Manually trigger checkpoint (for testing or emergency use)
   */
  triggerCheckpoint(): void {
    console.log('[Maintenance] Manual checkpoint triggered');
    this.performCheckpoint();
  }

  /**
   * Manually trigger optimization (for testing or emergency use)
   */
  triggerOptimization(): void {
    console.log('[Maintenance] Manual optimization triggered');
    this.performOptimization();
  }
}

// Singleton instance
const maintenanceService = new MaintenanceService();

export default maintenanceService;
