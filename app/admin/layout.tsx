import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: '#13110f' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col py-8 px-5"
        style={{ background: '#0e0c0a', borderRight: '1px solid #2a2520' }}
      >
        <div className="mb-10">
          <Link href="/">
            <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold)' }}>
              Lobby of Stories
            </p>
          </Link>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Admin</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {[
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/books', label: 'Books' },
            { href: '/admin/books/new', label: '+ Add Book' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 text-sm rounded transition-colors hover:text-white"
              style={{ color: 'var(--muted)' }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto">
          <UserButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-10 overflow-auto">{children}</main>
    </div>
  )
}
