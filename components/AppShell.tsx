import Link from 'next/link'
import BackButton from './BackButton'
import InstallButton from './InstallButton'
import BottomNav, { type NavSlot } from './BottomNav'
import ScrollPane from './ScrollPane'
import SiteFooter from './SiteFooter'

type Props = {
  children: React.ReactNode
  /** Which nav island slot to mark as current. */
  active?: NavSlot
  /**
   * The back button is permanent everywhere except Home (Discover), which has
   * nothing above it to go back to.
   */
  showBack?: boolean
  /** Where back lands when the visitor arrived here directly. */
  backFallbackHref?: string
}

/**
 * The app shell: a locked frame holding a static header, a single scrolling
 * region, and the nav island. Nothing but `.app-main` moves.
 *
 * Full-bleed screens — the cover page and the reader — deliberately opt out and
 * render their own frame instead.
 */
export default function AppShell({
  children,
  active,
  showBack = true,
  backFallbackHref = '/discover',
}: Props) {
  return (
    <div className="app-shell">
      <header className="app-header">
        {showBack && <BackButton fallbackHref={backFallbackHref} />}

        <Link href="/discover" className="app-header__brand">
          <span className="app-header__title">Lobby of Stories</span>
          <span className="app-header__sub">A personal library</span>
        </Link>

        <div className="app-header__trail">
          <InstallButton />
        </div>
      </header>

      <ScrollPane>
        {children}
        <SiteFooter />
      </ScrollPane>

      <BottomNav active={active} />
    </div>
  )
}
