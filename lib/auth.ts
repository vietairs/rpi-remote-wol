import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

export interface SessionData {
  userId: number;
  username: string;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createSession(userId: number, username: string): Promise<string> {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return token;
}

export async function verifySession(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    // Validate payload structure
    if (
      payload &&
      typeof payload.userId === 'number' &&
      typeof payload.username === 'string' &&
      typeof payload.exp === 'number'
    ) {
      return {
        userId: payload.userId,
        username: payload.username,
        exp: payload.exp,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: false, // Set to true only when using HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

// API Key functions
export function generateApiKey(): string {
  // Generate 32-byte random hex string (64 characters)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const randomHex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Add pcw_ prefix for easy identification
  return `pcw_${randomHex}`;
}

export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, 10);
}

export async function verifyApiKey(
  apiKey: string,
  hashedKey: string
): Promise<boolean> {
  return bcrypt.compare(apiKey, hashedKey);
}

/**
 * Verify API key from Authorization header (for API routes)
 * This runs in Node.js runtime (API routes), not Edge Runtime (middleware)
 * Returns userId if valid, null if invalid
 */
export async function verifyApiKeyHeader(request: Request): Promise<number | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Import here to avoid Edge Runtime issues if accidentally imported in middleware
    const { apiKeyDb } = await import('./db');

    // Check all API keys (need to verify hash)
    const allKeys = apiKeyDb.getAll();

    for (const keyRecord of allKeys) {
      const isValid = await verifyApiKey(apiKey, keyRecord.key_hash);
      if (isValid) {
        // Valid API key found - update last used timestamp
        apiKeyDb.updateLastUsed(keyRecord.key_hash);
        return keyRecord.created_by; // Return userId
      }
    }

    return null; // No valid API key found
  } catch (error) {
    console.error('[Auth] API key verification error:', error);
    return null;
  }
}
