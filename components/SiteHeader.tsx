import Link from 'next/link'
import { UserButton, SignInButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

type Props = {
  activePage?: 'home' | 'discover' | 'library'
}

export default async function SiteHeader({ activePage }: Props) {
  const { userId } = await auth()

  return (
    <header
      className="px-4 sm:px-8 py-5 flex justify-between items-center gap-4"
      style={{ borderBottom: '1px solid #2a2520' }}
    >
      <Link href="/">
        <div>
          <h1
            className="text-xl sm:text-2xl tracking-wide"
            style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
          >
            Lobby of Stories
          </h1>
          <p
            className="text-xs tracking-widest uppercase mt-1 hidden sm:block"
            style={{ color: 'var(--muted)' }}
          >
            A personal library
          </p>
        </div>
      </Link>

      <nav className="flex items-center gap-4 sm:gap-6 text-sm" style={{ color: 'var(--muted)' }}>
        <Link
          href="/discover"
          className="transition-colors hover:text-white"
          style={{ color: activePage === 'discover' ? 'var(--paper)' : 'var(--muted)' }}
        >
          Discover
        </Link>
        {userId && (
          <Link
            href="/library"
            className="transition-colors hover:text-white"
            style={{ color: activePage === 'library' ? 'var(--paper)' : 'var(--muted)' }}
          >
            Library
          </Link>
        )}
        {userId ? (
          <UserButton />
        ) : (
          <SignInButton mode="modal">
            <button className="hover:text-white transition-colors">Sign In</button>
          </SignInButton>
        )}
      </nav>
    </header>
  )
}
