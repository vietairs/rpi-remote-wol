import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { metricsDb } from '@/lib/db';

/**
 * POST /api/metrics/cleanup
 * Deletes metrics older than configured retention period (default: 365 days)
 * Supports optional query parameter: ?days=N to override retention
 *
 * Response:
 * {
 *   "deleted": number,
 *   "cleanedAt": string (ISO 8601),
 *   "retentionDays": number
 * }
 */
export async function POST(request: NextRequest) {
  // Check API key authentication first
  const apiKeyUserId = await verifyApiKeyHeader(request);

  if (!apiKeyUserId) {
    // No valid API key, check session cookie
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Get retention days from query parameter or environment variable
    const { searchParams } = new URL(request.url);
    const queryDays = searchParams.get('days');
    const retentionDays = queryDays
      ? parseInt(queryDays, 10)
      : parseInt(process.env.METRICS_RETENTION_DAYS || '365', 10);

    // Validate retention days (minimum 1 day, maximum 3650 days / 10 years)
    if (retentionDays < 1 || retentionDays > 3650) {
      return NextResponse.json(
        { error: 'Retention days must be between 1 and 3650' },
        { status: 400 }
      );
    }

    // Calculate cutoff timestamp
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - retentionDays * 24 * 3600;

    // Delete old metrics
    const deletedCount = metricsDb.deleteOlderThan(cutoffTimestamp);

    return NextResponse.json({
      deleted: deletedCount,
      cleanedAt: new Date().toISOString(),
      retentionDays,
    });
  } catch (error) {
    console.error('Metrics cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clean up metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
