import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notificationService } from '@/lib/notification-service';

/**
 * GET /api/notifications?unreadOnly=true&limit=50
 * Get notifications for current user
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const notifications = notificationService.getForUser(session.userId, unreadOnly, limit);
    const unreadCount = notificationService.getUnreadCount(session.userId);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Mark all notifications as read or delete old ones
 *
 * Request body:
 * {
 *   "action": "mark-all-read" | "cleanup"
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action } = await request.json();

    switch (action) {
      case 'mark-all-read': {
        const count = notificationService.markAllAsRead(session.userId);
        return NextResponse.json({
          message: `Marked ${count} notifications as read`,
          count,
        });
      }

      case 'cleanup': {
        const count = notificationService.deleteOldRead(7); // Delete read notifications older than 7 days
        return NextResponse.json({
          message: `Deleted ${count} old notifications`,
          count,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "mark-all-read" or "cleanup"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Notification action error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform action',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
