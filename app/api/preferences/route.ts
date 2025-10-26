import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { userPreferencesDb } from '@/lib/db';

/**
 * GET /api/preferences
 * Get current user's preferences
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const preferences = userPreferencesDb.getOrCreate(session.userId);

    return NextResponse.json({
      preferences: {
        ...preferences,
        enable_notifications: Boolean(preferences.enable_notifications),
      },
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/preferences
 * Update current user's preferences
 *
 * Request body:
 * {
 *   "metrics_poll_interval_ms"?: number (60000 - 3600000),
 *   "enable_notifications"?: boolean,
 *   "power_threshold_watts"?: number | null
 * }
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();

    // Validate inputs
    if (updates.metrics_poll_interval_ms !== undefined) {
      const minInterval = 60000; // 1 minute
      const maxInterval = 3600000; // 1 hour

      if (
        typeof updates.metrics_poll_interval_ms !== 'number' ||
        updates.metrics_poll_interval_ms < minInterval ||
        updates.metrics_poll_interval_ms > maxInterval
      ) {
        return NextResponse.json(
          {
            error: `Polling interval must be between ${minInterval}ms (1 minute) and ${maxInterval}ms (1 hour)`,
          },
          { status: 400 }
        );
      }
    }

    if (updates.enable_notifications !== undefined && typeof updates.enable_notifications !== 'boolean') {
      return NextResponse.json(
        { error: 'enable_notifications must be a boolean' },
        { status: 400 }
      );
    }

    if (
      updates.power_threshold_watts !== undefined &&
      updates.power_threshold_watts !== null &&
      (typeof updates.power_threshold_watts !== 'number' || updates.power_threshold_watts <= 0)
    ) {
      return NextResponse.json(
        { error: 'power_threshold_watts must be a positive number or null' },
        { status: 400 }
      );
    }

    const preferences = userPreferencesDb.update(session.userId, updates);

    if (!preferences) {
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: {
        ...preferences,
        enable_notifications: Boolean(preferences.enable_notifications),
      },
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
