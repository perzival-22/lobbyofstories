/**
 * scripts/backfill-emails.ts
 *
 * One-off diagnostic / backfill helper for placeholder user emails.
 *
 * Background:
 *   POST /api/progress upserts a User with a synthetic email of the form
 *   `<clerkId>@placeholder.local` when the Clerk webhook has not yet fired
 *   (e.g. CLERK_WEBHOOK_SECRET was not configured at sign-up time). Those rows
 *   never get a real email until a `user.updated` webhook arrives.
 *
 * What this script does TODAY:
 *   - Finds every User whose email ends in `@placeholder.local`
 *   - Logs them so you can see the scope of the problem
 *
 * Run with:
 *   npx tsx scripts/backfill-emails.ts
 *
 * NOTE: This script only REPORTS. It does not mutate the database.
 */

import { prisma } from '../lib/db';

async function main() {
  const placeholderUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@placeholder.local' } },
    select: { id: true, clerkId: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (placeholderUsers.length === 0) {
    console.log('✅ No users with @placeholder.local emails found.');
    return;
  }

  console.log(
    `Found ${placeholderUsers.length} user(s) with placeholder emails:\n`
  );
  for (const u of placeholderUsers) {
    console.log(
      `  - id=${u.id} clerkId=${u.clerkId} email=${u.email} createdAt=${u.createdAt.toISOString()}`
    );
  }

  // TODO: Once CLERK_WEBHOOK_SECRET is set and the webhook is verified working,
  // re-fetch each user's real primary email from Clerk's Backend API and update
  // the row, e.g.:
  //
  //   import { createClerkClient } from '@clerk/backend';
  //   const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  //   for (const u of placeholderUsers) {
  //     const clerkUser = await clerk.users.getUser(u.clerkId);
  //     const primaryId = clerkUser.primaryEmailAddressId;
  //     const realEmail = clerkUser.emailAddresses.find(
  //       (e) => e.id === primaryId
  //     )?.emailAddress;
  //     if (realEmail) {
  //       await prisma.user.update({
  //         where: { id: u.id },
  //         data: { email: realEmail },
  //       });
  //     }
  //   }
  //
  // This is intentionally left commented out — do not mutate until the webhook
  // path is confirmed and real emails are guaranteed to flow in going forward.
}

main()
  .catch((err) => {
    console.error('backfill-emails failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
