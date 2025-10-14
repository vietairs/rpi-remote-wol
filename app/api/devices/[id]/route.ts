import { NextRequest, NextResponse } from 'next/server';
import { deviceDb, DeviceInput } from '@/lib/db';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// PUT /api/devices/[id] - Update a device
export async function PUT(
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

    // Check if device exists
    const existingDevice = deviceDb.getById(deviceId);
    if (!existingDevice) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, macAddress, ipAddress, sshUsername, sshPassword } = body;

    if (!name || !macAddress) {
      return NextResponse.json(
        { error: 'Name and MAC address are required' },
        { status: 400 }
      );
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return NextResponse.json(
        { error: 'Invalid MAC address format' },
        { status: 400 }
      );
    }

    // Validate IP address format if provided
    if (ipAddress) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipAddress)) {
        return NextResponse.json(
          { error: 'Invalid IP address format' },
          { status: 400 }
        );
      }
    }

    // Check if MAC address is taken by another device
    const deviceWithMac = deviceDb.getByMac(macAddress);
    if (deviceWithMac && deviceWithMac.id !== deviceId) {
      return NextResponse.json(
        { error: 'A device with this MAC address already exists' },
        { status: 409 }
      );
    }

    const deviceInput: DeviceInput = {
      name,
      mac_address: macAddress,
      ip_address: ipAddress || null,
      ssh_username: sshUsername || null,
      ssh_password: sshPassword || null,
    };

    const updatedDevice = deviceDb.update(deviceId, deviceInput);

    if (!updatedDevice) {
      return NextResponse.json(
        { error: 'Failed to update device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      device: updatedDevice,
    });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json(
      { error: 'Failed to update device' },
      { status: 500 }
    );
  }
}

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
