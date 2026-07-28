'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/books', label: 'Books' },
  { href: '/admin/books/new', label: 'Add book' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="admin-nav">
      {LINKS.map(({ href, label }) => {
        // /admin matches only itself; the others own their subtrees.
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`admin-nav__link${active ? ' admin-nav__link--active' : ''}`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
