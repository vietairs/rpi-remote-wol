import { NextRequest, NextResponse } from 'next/server';
import { deviceDb } from '@/lib/db';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// DELETE /api/devices/[id] - Delete a device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;
    const deviceId = parseInt(id, 10);

    if (isNaN(deviceId)) {
      return NextResponse.json(
        { error: 'Invalid device ID' },
        { status: 400 }
      );
    }

    const success = deviceDb.delete(deviceId);

    if (!success) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      { error: 'Failed to delete device' },
      { status: 500 }
    );
  }
}
