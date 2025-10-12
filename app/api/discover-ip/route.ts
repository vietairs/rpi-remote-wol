import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { macAddress } = await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'MAC address is required' },
        { status: 400 }
      );
    }

    // Normalize MAC address format (remove : or - separators, make lowercase)
    const normalizedMac = macAddress.toLowerCase().replace(/[:-]/g, '');

    // Query ARP table
    const ipAddress = await findIpFromArp(normalizedMac);

    if (ipAddress) {
      return NextResponse.json({
        success: true,
        ipAddress,
        macAddress,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'IP address not found in ARP table. Device may be offline or not recently connected.',
      });
    }
  } catch (error) {
    console.error('IP discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to discover IP address' },
      { status: 500 }
    );
  }
}

async function findIpFromArp(targetMac: string): Promise<string | null> {
  try {
    // Use arp command to get ARP table
    // Works on Linux (Raspberry Pi)
    const { stdout } = await execPromise('arp -a');

    // Parse ARP table output
    // Format: <hostname> (<ip>) at <mac> [ether] on <interface>
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Extract MAC address from line
      const macMatch = line.match(/([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i);
      if (macMatch) {
        const lineMac = macMatch[0].toLowerCase().replace(/[:-]/g, '');

        if (lineMac === targetMac) {
          // Extract IP address
          const ipMatch = line.match(/\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/);
          if (ipMatch) {
            return ipMatch[1];
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('ARP lookup error:', error);
    return null;
  }
}
