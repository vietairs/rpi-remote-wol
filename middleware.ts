import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

// Simple in-memory cache for token verification (Edge Runtime compatible)
// Cache tokens for 5 minutes to reduce JWT verification overhead
const tokenCache = new Map<string, { valid: boolean; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isTokenCachedValid(token: string): boolean | null {
  const cached = tokenCache.get(token);
  if (!cached) return null;

  // Check if cache entry is still valid
  if (Date.now() > cached.expiry) {
    tokenCache.delete(token);
    return null;
  }

  return cached.valid;
}

function cacheToken(token: string, valid: boolean): void {
  // Limit cache size to prevent memory issues
  if (tokenCache.size > 1000) {
    // Remove oldest 200 entries
    const entries = Array.from(tokenCache.entries());
    entries.slice(0, 200).forEach(([key]) => tokenCache.delete(key));
  }

  tokenCache.set(token, {
    valid,
    expiry: Date.now() + CACHE_TTL,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init'];

  // Check if the path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // NOTE: API key authentication is now handled in individual API routes
  // This middleware only handles JWT cookie authentication for web UI

  // If this is an API route with Bearer token, let the route handle authentication
  if (pathname.startsWith('/api/') && request.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  // JWT cookie authentication for web UI
  const token = request.cookies.get('session')?.value;

  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check cache first to reduce JWT verification overhead
  const cachedValid = isTokenCachedValid(token);
  if (cachedValid !== null) {
    if (cachedValid) {
      return NextResponse.next();
    } else {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  // Verify the session token (not in cache)
  const session = await verifySession(token);

  // Cache the result
  cacheToken(token, session !== null);

  // If session is invalid, redirect to login
  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  // Session is valid, continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (all API routes handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
