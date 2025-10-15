import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';
import { deviceDb, metricsDb } from '@/lib/db';

/**
 * GET /api/metrics/[deviceId]/energy?period=day|month|year
 * Calculates energy consumption (kWh) for a device over a time period
 *
 * Query params:
 * - period: "day", "month", "year" (default: "day")
 *
 * Response:
 * {
 *   "deviceId": number,
 *   "period": string,
 *   "startTimestamp": number,
 *   "endTimestamp": number,
 *   "energyConsumption": {
 *     "kWh": number,
 *     "dataPoints": number
 *   },
 *   "powerStats": {
 *     "avgWatts": number | null,
 *     "maxWatts": number | null,
 *     "minWatts": number | null,
 *     "dataPoints": number
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

    // Parse period query parameter
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day';

    // Calculate time range in seconds
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp: number;
    let periodLabel: string;

    switch (period) {
      case 'day':
        startTimestamp = now - 24 * 3600;
        periodLabel = 'Last 24 hours';
        break;
      case 'month':
        startTimestamp = now - 30 * 24 * 3600;
        periodLabel = 'Last 30 days';
        break;
      case 'year':
        startTimestamp = now - 365 * 24 * 3600;
        periodLabel = 'Last 365 days';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid period. Use "day", "month", or "year"' },
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

    // Get energy consumption using trapezoidal integration
    const energyConsumption = metricsDb.getEnergyConsumption(
      deviceId,
      startTimestamp,
      now
    );

    // Get power statistics
    const powerStats = metricsDb.getPowerStats(
      deviceId,
      startTimestamp,
      now
    );

    return NextResponse.json({
      deviceId,
      period,
      periodLabel,
      startTimestamp,
      endTimestamp: now,
      startDate: new Date(startTimestamp * 1000).toISOString(),
      endDate: new Date(now * 1000).toISOString(),
      energyConsumption: {
        kWh: energyConsumption.energyKwh,
        dataPoints: energyConsumption.dataPoints,
      },
      powerStats: {
        avgWatts: powerStats.avgPowerW,
        maxWatts: powerStats.maxPowerW,
        minWatts: powerStats.minPowerW,
        dataPoints: powerStats.dataPoints,
      },
    });
  } catch (error) {
    console.error('Get energy consumption error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate energy consumption',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
