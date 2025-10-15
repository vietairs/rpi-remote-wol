import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { deviceDb, metricsDb } from '@/lib/db';

/**
 * GET /api/metrics/[deviceId]?duration=1h|6h|24h
 * Retrieves historical metrics for a device
 *
 * Query params:
 * - duration: "1h", "6h", "24h" (default: "24h")
 *
 * Response:
 * {
 *   "deviceId": number,
 *   "duration": string,
 *   "dataPoints": number,
 *   "metrics": {
 *     "cpu": [{ "timestamp": number, "value": number | null }, ...],
 *     "ram": [{ "timestamp": number, "value": number | null }, ...],
 *     "gpu": [{ "timestamp": number, "value": number | null }, ...],
 *     "network": {
 *       "rx": [{ "timestamp": number, "value": number | null }, ...],
 *       "tx": [{ "timestamp": number, "value": number | null }, ...]
 *     }
 *   }
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

    // Parse duration query parameter
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || '24h';

    // Calculate time range in seconds
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp: number;

    switch (duration) {
      case '1h':
        startTimestamp = now - 3600;
        break;
      case '6h':
        startTimestamp = now - 6 * 3600;
        break;
      case '24h':
        startTimestamp = now - 24 * 3600;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid duration. Use "1h", "6h", or "24h"' },
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

    // Get historical metrics
    const historicalMetrics = metricsDb.getHistoricalForDevice(
      deviceId,
      startTimestamp,
      now
    );

    if (historicalMetrics.length === 0) {
      return NextResponse.json({
        deviceId,
        duration,
        dataPoints: 0,
        metrics: {
          cpu: [],
          ram: [],
          gpu: [],
          network: { rx: [], tx: [] },
        },
      });
    }

    // Format data for charting
    const cpu = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.cpu_percent,
    }));

    const ram = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.ram_percent,
    }));

    const gpu = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.gpu_percent,
    }));

    const networkRx = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.network_rx_mbps,
    }));

    const networkTx = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.network_tx_mbps,
    }));

    const power = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.power_consumption_w,
    }));

    return NextResponse.json({
      deviceId,
      duration,
      dataPoints: historicalMetrics.length,
      metrics: {
        cpu,
        ram,
        gpu,
        network: {
          rx: networkRx,
          tx: networkTx,
        },
        power,
      },
    });
  } catch (error) {
    console.error('Get historical metrics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve historical metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
