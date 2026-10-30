import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { claimedUser, DEMO_COOKIE } from './server/auth/identity';

// Default deny. API routes do their own auth so they answer JSON 401 rather than a redirect, and the dev pages 404 themselves in production.
const PUBLIC = /^\/(?:(?:how-it-works|pricing|signup|sign-in|demo|dev|api)(?:\/.*)?)?$/;

export default clerkMiddleware(
  async (auth, request) => {
    const query = request.nextUrl.searchParams.get('user');
    const claim = claimedUser([query, request.cookies.get(DEMO_COOKIE)?.value]);
    if (claim) {
      const response = NextResponse.next();
      if (query) response.cookies.set(DEMO_COOKIE, claim, { httpOnly: true, sameSite: 'lax' });
      return response;
    }
    if (!PUBLIC.test(request.nextUrl.pathname)) await auth.protect();
  },
  { signInUrl: '/sign-in', signUpUrl: '/signup' },
);

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
