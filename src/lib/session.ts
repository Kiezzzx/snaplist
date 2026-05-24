import 'server-only';
import { cookies } from 'next/headers';

export const ANON_SESSION_COOKIE = 'anon_session_id';

// Resolves the current owner scope for listing queries. Middleware guarantees
// every visitor carries an anon_session_id cookie, so reads after the first
// request always return a value.
//
// Phase 0 (Auth.js) will extend this: a logged-in user's queries scope to
// their userId, with the anon session only used during the claim handoff.
// Keeping that resolution behind this one function means the dashboard, detail
// page, and listing actions don't each need editing when auth lands.
export async function getAnonSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANON_SESSION_COOKIE)?.value ?? null;
}
