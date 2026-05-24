import { NextResponse, type NextRequest } from 'next/server';

// Mirrors ANON_SESSION_COOKIE in lib/session.ts. Duplicated as a literal rather
// than imported because middleware runs on the Edge runtime, which must not
// pull in the 'server-only' module graph that session.ts belongs to.
const ANON_SESSION_COOKIE = 'anon_session_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// ECL Stage 0: every anonymous visitor is assigned an anonymousSessionId stored
// in a SameSite=Lax cookie. Issuing it here — before any page or action runs —
// means every listing read/write shares one stable owner key per browser.
export function middleware(req: NextRequest) {
  if (req.cookies.get(ANON_SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const sessionId = crypto.randomUUID();

  // Set on the request, not just the response, so the very first render of this
  // same request — e.g. a cold visit straight to /dashboard — already sees the
  // id via cookies(). Without this the column would read null until a reload.
  req.cookies.set(ANON_SESSION_COOKIE, sessionId);
  const res = NextResponse.next({ request: { headers: req.headers } });

  // httpOnly: the id is only ever read server-side via cookies(); no client JS
  // needs it, so keep it out of reach of XSS.
  res.cookies.set(ANON_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
}

export const config = {
  // Run on pages, API routes, and server actions alike (so uploads and reads
  // share one session), but skip Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
