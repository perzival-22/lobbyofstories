import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { getCurrentBook } from '@/lib/currentBook'
import { NavAccount, NavSignIn } from './NavAuthItems'

export type NavSlot = 'home' | 'book' | 'account'

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </svg>
)

const BookIcon = (
  <svg {...iconProps}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
    <path d="M4 19.5A1.5 1.5 0 0 1 5.5 21H19" />
  </svg>
)

const UserIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
  </svg>
)

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`app-nav__item${active ? ' app-nav__item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="app-nav__icon">{icon}</span>
      <span className="app-nav__label">{label}</span>
    </Link>
  )
}

/**
 * The floating nav island: Home · Current book · Account.
 *
 * A static sibling of the scroll tube rather than a fixed overlay, so mobile
 * browser chrome resizing the viewport can never make it jump.
 */
export default async function BottomNav({ active }: { active?: NavSlot }) {
  const { userId } = await auth()
  const current = userId ? await getCurrentBook() : null

  return (
    <nav className="app-nav" aria-label="Primary">
      <div className="app-nav__island">
        <NavLink href="/discover" label="Home" icon={HomeIcon} active={active === 'home'} />

        {!userId ? (
          <NavSignIn label="Library" icon={BookIcon} />
        ) : current ? (
          <NavLink
            href={`/book/${current.bookId}/read?chapter=${current.chapterId}`}
            label={current.title}
            icon={BookIcon}
            active={active === 'book'}
          />
        ) : (
          <NavLink href="/library" label="Library" icon={BookIcon} active={active === 'book'} />
        )}

        {userId ? <NavAccount /> : <NavSignIn label="Sign in" icon={UserIcon} />}
      </div>
    </nav>
  )
}
