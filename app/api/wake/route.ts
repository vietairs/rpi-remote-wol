import { NextRequest, NextResponse } from 'next/server';
import wol from 'wake_on_lan';

export async function POST(request: NextRequest) {
  try {
    const { macAddress } = await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'MAC address is required' },
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

    // Send Wake-on-LAN magic packet
    await new Promise((resolve, reject) => {
      wol.wake(macAddress, (error: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Wake-on-LAN packet sent successfully',
      macAddress
    });
  } catch (error) {
    console.error('Wake-on-LAN error:', error);
    return NextResponse.json(
      { error: 'Failed to send Wake-on-LAN packet' },
      { status: 500 }
    );
  }
}
