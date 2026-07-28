import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Playfair_Display, Lora } from 'next/font/google'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import './globals.css'

// Self-hosted via next/font (no external Google Fonts <link> request).
// Exposed as CSS variables and consumed throughout the app.
const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
})

// viewport-fit=cover lets the shell paint into the notch and home-indicator
// areas; the CSS pads them back with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#1a1714',
  colorScheme: 'dark',
  // Keeps the locked frame sized to what's actually visible when the on-screen
  // keyboard opens, rather than letting it slide under.
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'Lobby of Stories',
  description: 'A personal library of original serialized fiction.',
  applicationName: 'Lobby of Stories',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Lobby of Stories',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Lobby of Stories',
    description: 'A personal library of original serialized fiction.',
    url: 'https://lobbyofstories.space',
    siteName: 'Lobby of Stories',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Lobby of Stories',
    description: 'A personal library of original serialized fiction.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${playfair.variable} ${lora.variable}`}>
        <body>
          {children}
          <ServiceWorkerRegistrar />
        </body>
      </html>
    </ClerkProvider>
  )
}
