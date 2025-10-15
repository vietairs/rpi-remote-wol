import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { deviceDb, metricsDb } from '@/lib/db';

/**
 * GET /api/metrics/[deviceId]/latest
 * Retrieves the most recent metrics for a device from the database
 *
 * Response:
 * {
 *   "deviceId": number,
 *   "metrics": {
 *     "cpu": number | null,
 *     "ram": { "used": number | null, "total": number | null, "percent": number | null },
 *     "gpu": { "usage": number | null, "memoryUsed": number | null, "memoryTotal": number | null } | null,
 *     "network": { "rxMbps": number | null, "txMbps": number | null } | null
 *   },
 *   "timestamp": number,
 *   "collectedAt": string (ISO 8601)
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
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
    const { deviceId: deviceIdParam } = await params;
    const deviceId = parseInt(deviceIdParam, 10);

    if (isNaN(deviceId)) {
      return NextResponse.json(
        { error: 'Invalid deviceId' },
        { status: 400 }
      );
    }

    // Verify device exists
    const device = deviceDb.getById(deviceId);

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get latest metrics
    const latestMetrics = metricsDb.getLatestForDevice(deviceId);

    if (!latestMetrics) {
      return NextResponse.json(
        {
          deviceId,
          metrics: null,
          message: 'No metrics available for this device yet',
        },
        { status: 200 }
      );
    }

    // Format response
    return NextResponse.json({
      deviceId,
      metrics: {
        cpu: latestMetrics.cpu_percent,
        ram: {
          used: latestMetrics.ram_used_gb,
          total: latestMetrics.ram_total_gb,
          percent: latestMetrics.ram_percent,
        },
        gpu: latestMetrics.gpu_percent
          ? {
              usage: latestMetrics.gpu_percent,
              memoryUsed: latestMetrics.gpu_memory_used_mb,
              memoryTotal: latestMetrics.gpu_memory_total_mb,
            }
          : null,
        network: latestMetrics.network_rx_mbps
          ? {
              rxMbps: latestMetrics.network_rx_mbps,
              txMbps: latestMetrics.network_tx_mbps,
            }
          : null,
        power: latestMetrics.power_consumption_w
          ? {
              watts: latestMetrics.power_consumption_w,
              estimated: latestMetrics.power_estimated === 1,
            }
          : null,
      },
      timestamp: latestMetrics.timestamp,
      collectedAt: new Date(latestMetrics.timestamp * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Get latest metrics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
