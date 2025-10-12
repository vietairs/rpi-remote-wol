import { NextRequest, NextResponse } from 'next/server';
import { probe } from 'tcp-ping';

export async function POST(request: NextRequest) {
  try {
    const { ipAddress } = await request.json();

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }

    // Check if host is reachable (port 445 SMB or 135 RPC - common Windows ports)
    const hostCheck = await checkPort(ipAddress, 445, 2000);

    // Check if RDP port (3389) is available
    const rdpCheck = await checkPort(ipAddress, 3389, 2000);

    const isOnline = hostCheck || rdpCheck;
    const isRdpReady = rdpCheck;

    return NextResponse.json({
      ipAddress,
      online: isOnline,
      rdpReady: isRdpReady,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check device status' },
      { status: 500 }
    );
  }
}

function checkPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    probe(host, port, (err, available) => {
      if (err) {
        resolve(false);
      } else {
        resolve(available);
      }
    }, { timeout });
  });
}
