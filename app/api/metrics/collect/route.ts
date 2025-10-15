import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { deviceDb, metricsDb } from '@/lib/db';
import { collectMetrics } from '@/lib/metrics';

/**
 * POST /api/metrics/collect
 * Collects system metrics from a device via SSH and stores in database
 *
 * Request body:
 * {
 *   "deviceId": number
 * }
 *
 * Response:
 * {
 *   "deviceId": number,
 *   "metrics": {
 *     "cpu": number,
 *     "ram": { "used": number, "total": number, "percent": number },
 *     "gpu": { "usage": number, "memoryUsed": number, "memoryTotal": number } | null,
 *     "network": { "rxMbps": number, "txMbps": number } | null
 *   },
 *   "timestamp": number,
 *   "collectedAt": string (ISO 8601)
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
    const { deviceId } = await request.json();

    if (!deviceId || typeof deviceId !== 'number') {
      return NextResponse.json(
        { error: 'Valid deviceId is required' },
        { status: 400 }
      );
    }

    // Get device from database
    const device = deviceDb.getById(deviceId);

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Collect metrics via SSH
    const result = await collectMetrics(device);

    if (!result.success || !result.metrics) {
      return NextResponse.json(
        {
          error: 'Failed to collect metrics',
          details: result.error || 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Store metrics in database
    metricsDb.create({
      device_id: deviceId,
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
      timestamp: result.timestamp,
    });

    return NextResponse.json({
      deviceId,
      metrics: result.metrics,
      timestamp: result.timestamp,
      collectedAt: new Date(result.timestamp * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Metrics collection error:', error);
    return NextResponse.json(
      {
        error: 'Failed to collect metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
