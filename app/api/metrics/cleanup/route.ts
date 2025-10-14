import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { metricsDb } from '@/lib/db';

/**
 * POST /api/metrics/cleanup
 * Deletes metrics older than 24 hours (retention policy)
 *
 * Response:
 * {
 *   "deleted": number,
 *   "cleanedAt": string (ISO 8601)
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
    // Calculate 24-hour cutoff timestamp
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - 24 * 3600;

    // Delete old metrics
    const deletedCount = metricsDb.deleteOlderThan(cutoffTimestamp);

    return NextResponse.json({
      deleted: deletedCount,
      cleanedAt: new Date().toISOString(),
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
