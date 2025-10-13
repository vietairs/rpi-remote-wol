import { NextRequest, NextResponse } from 'next/server';
import { NodeSSH } from 'node-ssh';
import { deviceDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Get device from database
    const device = deviceDb.getById(deviceId);

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    if (!device.ip_address) {
      return NextResponse.json(
        { error: 'Device IP address not configured' },
        { status: 400 }
      );
    }

    if (!device.ssh_username || !device.ssh_password) {
      return NextResponse.json(
        { error: 'SSH credentials not configured for this device' },
        { status: 400 }
      );
    }

    // Connect via SSH and execute sleep command
    const ssh = new NodeSSH();

    try {
      await ssh.connect({
        host: device.ip_address,
        username: device.ssh_username,
        password: device.ssh_password,
        readyTimeout: 10000,
      });

      // Execute sleep command for Windows using rundll32
      const result = await ssh.execCommand('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');

      ssh.dispose();

      if (result.code === 0 || result.code === undefined) {
        return NextResponse.json({
          success: true,
          message: `Sleep command sent to ${device.name}`,
          deviceName: device.name,
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to execute sleep command',
            details: result.stderr || result.stdout
          },
          { status: 500 }
        );
      }
    } catch (sshError) {
      ssh.dispose();
      return NextResponse.json(
        {
          error: 'Failed to connect via SSH',
          details: sshError instanceof Error ? sshError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Sleep error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process sleep request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
