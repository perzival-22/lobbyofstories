import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

const isPublicRoute = createRouteMatcher([
  '/',
  '/discover',
  '/book/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/books(.*)',
  '/api/webhooks/(.*)', // Clerk webhook must be reachable without a session
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  if (isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    if (!isAdmin(userId)) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
