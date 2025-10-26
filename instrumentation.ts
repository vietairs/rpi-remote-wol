/**
 * Next.js Instrumentation Hook
 * This file runs once when the Node.js server starts
 * Perfect for initializing background services
 */

export async function register() {
  // Only run in Node.js runtime (not Edge Runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server...');

    // Dynamically import to avoid Edge Runtime issues
    const maintenanceService = (await import('./lib/maintenance-service')).default;
    const { startScheduler, stopScheduler } = await import('./lib/scheduler');

    // Start background maintenance service
    // Checkpoint every 6 hours, optimize every 24 hours
    maintenanceService.start(6, 24);

    // Start metrics collection scheduler
    startScheduler();

    // Graceful shutdown handler
    const shutdown = () => {
      console.log('[Instrumentation] Shutting down gracefully...');
      maintenanceService.stop();
      stopScheduler();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    console.log('[Instrumentation] Server initialization complete');
  }
}
