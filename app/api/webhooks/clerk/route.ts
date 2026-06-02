import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/db'

// Clerk sends a svix-signed POST to this endpoint on user events.
// Required env var: CLERK_WEBHOOK_SECRET (from Clerk Dashboard → Webhooks)
//
// Setup steps:
// 1. npm install svix
// 2. In Clerk Dashboard → Webhooks → Add Endpoint:
//    URL: https://your-domain.com/api/webhooks/clerk
//    Events: user.created, user.updated, user.deleted
// 3. Copy the Signing Secret → add to .env.local as CLERK_WEBHOOK_SECRET

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses: { email_address: string; id: string }[]
    primary_email_address_id: string
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET

  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify signature using svix
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let event: ClerkUserEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  try {
    if (type === 'user.created') {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address ?? `${data.id}@unknown.local`

      await prisma.user.upsert({
        where: { clerkId: data.id },
        update: { email: primaryEmail },
        create: {
          clerkId: data.id,
          email: primaryEmail,
        },
      })

      console.log(`User created: ${data.id} (${primaryEmail})`)
    }

    if (type === 'user.updated') {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address

      if (primaryEmail) {
        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: { email: primaryEmail },
          create: {
            clerkId: data.id,
            email: primaryEmail,
          },
        })
        console.log(`User updated: ${data.id} (${primaryEmail})`)
      }
    }

    if (type === 'user.deleted') {
      // Cascade delete handles ReadingProgress via schema onDelete: Cascade
      await prisma.user.deleteMany({ where: { clerkId: data.id } })
      console.log(`User deleted: ${data.id}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook DB operation failed:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
