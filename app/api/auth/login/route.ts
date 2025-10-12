import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    console.log('[Login API] Login attempt for user:', username);

    if (!username || !password) {
      console.log('[Login API] Missing credentials');
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = userDb.getByUsername(username);

    if (!user) {
      console.log('[Login API] User not found:', username);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    console.log('[Login API] User found, verifying password');

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      console.log('[Login API] Invalid password');
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    console.log('[Login API] Password valid, creating session');

    // Create session token
    const token = await createSession(user.id, user.username);

    console.log('[Login API] Session token created, setting cookie');

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });

    // Set session cookie on the response
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('[Login API] Cookie set, returning success');

    return response;
  } catch (error) {
    console.error('[Login API] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
