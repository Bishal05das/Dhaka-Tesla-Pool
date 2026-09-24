import { type NextRequest, NextResponse } from 'next/server';

// First, cheap gate: no session cookie → straight to sign-in, before any page renders.
// This only checks that a cookie exists. Whether it is valid, and whether the role fits the
// area, is decided by the API on every request (and mirrored in <RoleGate> for the UI).
export function proxy(request: NextRequest) {
  if (!request.cookies.has('dt_session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/passenger/:path*', '/driver/:path*'],
};
