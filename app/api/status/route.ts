import { NextRequest, NextResponse } from 'next/server';
import { probe } from 'tcp-ping';
import { verifyApiKeyHeader, getSession } from '@/lib/auth';

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
    // Log error without flooding logs - connection resets are expected for offline devices
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!errorMessage.includes('ECONNRESET') && !errorMessage.includes('aborted')) {
      console.error('Status check error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to check device status' },
      { status: 500 }
    );
  }
}

function checkPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      probe(host, port, (err, available) => {
        if (err) {
          resolve(false);
        } else {
          resolve(available);
        }
      }, { timeout });
    } catch {
      // Catch synchronous errors from probe (socket creation, etc.)
      resolve(false);
    }
  }).catch(() => {
    // Catch any unhandled promise rejections
    return false;
  }) as Promise<boolean>;
}
