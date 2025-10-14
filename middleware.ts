import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, verifyApiKey } from './lib/auth';
import { apiKeyDb } from './lib/db';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init'];

  // Check if the path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // NEW: Check for Bearer token (API key authentication)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Try to find and verify the API key
    try {
      // Note: We need to check against all hashed keys since we can't reverse the hash
      // This is less efficient but secure. For better performance, consider caching.
      const allKeys = apiKeyDb.getAll();

      for (const keyRecord of allKeys) {
        const isValid = await verifyApiKey(apiKey, keyRecord.key_hash);
        if (isValid) {
          // Valid API key found - update last used timestamp
          apiKeyDb.updateLastUsed(keyRecord.key_hash);
          console.log('[Middleware] API key authenticated:', keyRecord.name);
          return NextResponse.next();
        }
      }

      // No matching API key found - fall through to cookie auth
      console.log('[Middleware] Invalid API key, trying cookie auth');
    } catch (error) {
      console.error('[Middleware] API key verification error:', error);
      // Fall through to cookie auth on error
    }
  }

  // EXISTING: JWT cookie authentication (unchanged)
  const token = request.cookies.get('session')?.value;

  console.log('[Middleware]', pathname, 'Token:', token ? 'exists' : 'missing');

  // If no token, redirect to login
  if (!token) {
    console.log('[Middleware] No token, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify the session token
  const session = await verifySession(token);

  console.log('[Middleware] Session valid:', session ? 'yes' : 'no');

  // If session is invalid, redirect to login
  if (!session) {
    console.log('[Middleware] Invalid session, redirecting to login');
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  // Session is valid, continue
  console.log('[Middleware] Access granted to', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
