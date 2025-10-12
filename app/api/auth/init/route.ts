import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check if any users exist
    const userCount = userDb.count();

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Users already exist. Cannot initialize.' },
        { status: 403 }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Create first admin user
    const password_hash = await hashPassword(password);
    const user = userDb.create({ username, password_hash });

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize admin user' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userCount = userDb.count();

    return NextResponse.json({
      needsInitialization: userCount === 0,
      userCount,
    });
  } catch (error) {
    console.error('Init check error:', error);
    return NextResponse.json(
      { error: 'Failed to check initialization status' },
      { status: 500 }
    );
  }
}
