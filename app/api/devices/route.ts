import { NextRequest, NextResponse } from 'next/server';
import { deviceDb, DeviceInput } from '@/lib/db';

// GET /api/devices - Get all saved devices
export async function GET() {
  try {
    const devices = deviceDb.getAll();
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

// POST /api/devices - Create a new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, macAddress, ipAddress } = body;

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

    // Check if MAC address already exists
    const existing = deviceDb.getByMac(macAddress);
    if (existing) {
      return NextResponse.json(
        { error: 'A device with this MAC address already exists' },
        { status: 409 }
      );
    }

    const deviceInput: DeviceInput = {
      name,
      mac_address: macAddress,
      ip_address: ipAddress,
    };

    const device = deviceDb.create(deviceInput);

    return NextResponse.json({
      success: true,
      device,
    });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}
