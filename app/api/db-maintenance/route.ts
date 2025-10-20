import { NextResponse } from 'next/server';
import { checkpointWal, optimizeDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * Database maintenance endpoint
 * Performs WAL checkpoint and optional optimization
 * Should be called periodically via cron job on Raspberry Pi
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
      // Perform WAL checkpoint
      const result = checkpointWal();

      return NextResponse.json({
        success: true,
        operation: 'checkpoint',
        framesCheckpointed: result.framesCheckpointed,
        framesInWal: result.framesInWal,
        message: 'WAL checkpoint completed',
      });
    } else if (operation === 'optimize') {
      // Optimize database (ANALYZE)
      optimizeDb();

      return NextResponse.json({
        success: true,
        operation: 'optimize',
        message: 'Database optimization completed',
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
 * GET endpoint to check database status
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
      walFrames: walStatus.framesInWal,
      lastCheckpoint: new Date().toISOString(),
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
