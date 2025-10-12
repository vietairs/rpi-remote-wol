import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/init'];

  // Check if the path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get session token from cookies
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
