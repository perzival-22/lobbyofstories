import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

// Conservative Content-Security-Policy verified against the app's actual usage:
//   - Clerk auth widgets/scripts/API   (*.clerk.accounts.dev, *.clerk.com, and
//     the production frontend API clerk.lobbyofstories.space) + Cloudflare
//     Turnstile (challenges.cloudflare.com) which Clerk uses for bot checks
//   - Google Fonts CSS (fonts.googleapis.com) + font files (fonts.gstatic.com)
//   - Vercel Blob cover images (*.public.blob.vercel-storage.com)
//   - Clerk user images (img.clerk.com)
//
// 'unsafe-inline' is required for style (the app uses inline style={{}} heavily
// and Google Fonts/Clerk inject inline styles) and for Next.js' inline
// bootstrap/hydration scripts (no nonce pipeline is configured). 'unsafe-eval'
// is enabled only in development for Turbopack/HMR.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.lobbyofstories.space https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com https://img.clerk.com`,
  `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.lobbyofstories.space`,
  `worker-src 'self' blob:`,
  `frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: '*.public.blob.vercel-storage.com' },
      { hostname: 'blob.vercel-storage.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
