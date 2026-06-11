import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Playfair_Display, Lora } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'Lobby of Stories',
  description: 'A personal library of original serialized fiction.',
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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
