import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getScheduler } from '@/lib/scheduler';

/**
 * GET /api/scheduler
 * Get current scheduler state and configuration
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scheduler = getScheduler();

  if (!scheduler) {
    return NextResponse.json(
      { error: 'Scheduler not initialized' },
      { status: 503 }
    );
  }

  const state = scheduler.getState();
  const config = scheduler.getConfig();

  return NextResponse.json({
    config,
    state: {
      ...state,
      lastRun: state.lastRun?.toISOString() || null,
      nextRun: state.nextRun?.toISOString() || null,
    },
  });
}

/**
 * POST /api/scheduler
 * Control scheduler actions (start, stop, run-now)
 *
 * Request body:
 * {
 *   "action": "start" | "stop" | "run-now"
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scheduler = getScheduler();

  if (!scheduler) {
    return NextResponse.json(
      { error: 'Scheduler not initialized' },
      { status: 503 }
    );
  }

  try {
    const { action } = await request.json();

    switch (action) {
      case 'start':
        scheduler.start();
        return NextResponse.json({
          message: 'Scheduler started',
          state: scheduler.getState(),
        });

      case 'stop':
        scheduler.stop();
        return NextResponse.json({
          message: 'Scheduler stopped',
          state: scheduler.getState(),
        });

      case 'run-now':
        // Run collection cycle immediately (non-blocking)
        scheduler.runNow().catch((error) => {
          console.error('[API] Scheduler run-now error:', error);
        });
        return NextResponse.json({
          message: 'Collection cycle triggered',
          state: scheduler.getState(),
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "start", "stop", or "run-now"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Scheduler control error:', error);
    return NextResponse.json(
      {
        error: 'Failed to control scheduler',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scheduler
 * Update scheduler configuration
 *
 * Request body:
 * {
 *   "enabled"?: boolean,
 *   "intervalMs"?: number,
 *   "maxConcurrent"?: number
 * }
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scheduler = getScheduler();

  if (!scheduler) {
    return NextResponse.json(
      { error: 'Scheduler not initialized' },
      { status: 503 }
    );
  }

  try {
    const updates = await request.json();

    // Validate updates
    if (updates.intervalMs !== undefined) {
      const minInterval = 60000; // 1 minute
      const maxInterval = 3600000; // 1 hour
      if (updates.intervalMs < minInterval || updates.intervalMs > maxInterval) {
        return NextResponse.json(
          {
            error: `Interval must be between ${minInterval}ms (1min) and ${maxInterval}ms (1hr)`,
          },
          { status: 400 }
        );
      }
    }

    if (updates.maxConcurrent !== undefined) {
      if (updates.maxConcurrent < 1 || updates.maxConcurrent > 10) {
        return NextResponse.json(
          { error: 'Max concurrent must be between 1 and 10' },
          { status: 400 }
        );
      }
    }

    scheduler.updateConfig(updates);

    return NextResponse.json({
      message: 'Scheduler configuration updated',
      config: scheduler.getConfig(),
      state: scheduler.getState(),
    });
  } catch (error) {
    console.error('Scheduler config update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update scheduler config',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
