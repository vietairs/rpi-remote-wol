import { NextResponse } from 'next/server';
import { checkpointWal, optimizeDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import maintenanceService from '@/lib/maintenance-service';

/**
 * Database maintenance endpoint
 * Performs manual WAL checkpoint and optional optimization
 * Background service automatically handles periodic maintenance
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { operation } = body;

    if (operation === 'checkpoint') {
      // Manual WAL checkpoint trigger
      maintenanceService.triggerCheckpoint();
      const result = checkpointWal();

      return NextResponse.json({
        success: true,
        operation: 'checkpoint',
        framesCheckpointed: result.framesCheckpointed,
        framesInWal: result.framesInWal,
        message: 'Manual WAL checkpoint completed',
      });
    } else if (operation === 'optimize') {
      // Manual optimization trigger
      maintenanceService.triggerOptimization();
      optimizeDb();

      return NextResponse.json({
        success: true,
        operation: 'optimize',
        message: 'Manual database optimization completed',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid operation. Use "checkpoint" or "optimize"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[DB Maintenance] Error:', error);
    return NextResponse.json(
      {
        error: 'Database maintenance failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check database and service status
 */
export async function GET() {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current WAL status
    const walStatus = checkpointWal();

    return NextResponse.json({
      success: true,
      backgroundService: {
        running: maintenanceService.isActive(),
        checkpointIntervalHours: 6,
        optimizeIntervalHours: 24,
      },
      database: {
        walFrames: walStatus.framesInWal,
        walFramesCheckpointed: walStatus.framesCheckpointed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DB Maintenance] Status check error:', error);
    return NextResponse.json(
      {
        error: 'Database status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
