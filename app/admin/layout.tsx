import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import AdminNav from '@/components/admin/AdminNav'

/**
 * Admin shell. Locked to the viewport height with no scroll of its own so the
 * book workspace can hand its editor the full remaining height; pages that do
 * want to scroll wrap themselves in `.admin-page`.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <Link href="/">
            <p className="admin-sidebar__mark">Lobby of Stories</p>
          </Link>
          <p className="admin-sidebar__sub">Admin</p>
        </div>

        <AdminNav />

        <div className="admin-sidebar__foot">
          <UserButton />
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  )
}
