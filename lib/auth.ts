/**
 * lib/auth.ts
 *
 * Single source of truth for "is this user an admin?". Every admin check in the
 * app (middleware, upload, books, books/[id], ingest) routes through isAdmin()
 * so the policy can be swapped in one place.
 *
 * Current implementation: compare the Clerk userId against the ADMIN_USER_ID
 * env var. Fails closed when the env var is unset.
 *
 * To migrate to Clerk roles later, replace the body with a check against the
 * user's publicMetadata, e.g.:
 *
 *   import { auth } from '@clerk/nextjs/server';
 *   const { sessionClaims } = await auth();
 *   return sessionClaims?.metadata?.role === 'admin';
 *
 * (sessionClaims.publicMetadata.role === 'admin'). That requires configuring a
 * custom session token claim in the Clerk dashboard and is async, so callers
 * would need to await it.
 */
export function isAdmin(userId: string | null | undefined): boolean {
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId) return false;
  return userId === adminUserId;
}
