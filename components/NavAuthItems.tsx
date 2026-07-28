'use client'

import { UserButton, SignInButton } from '@clerk/nextjs'

/**
 * The two nav slots that need Clerk's own interactive widgets.
 */

const avatarAppearance = {
  elements: {
    avatarBox: { width: '20px', height: '20px' },
    userButtonTrigger: { padding: 0 },
  },
}

/** Signed-in account slot: Clerk's avatar menu, labelled to match its siblings. */
export function NavAccount() {
  return (
    <div className="app-nav__item">
      <span className="app-nav__icon app-nav__avatar">
        <UserButton appearance={avatarAppearance} />
      </span>
      <span className="app-nav__label">Account</span>
    </div>
  )
}

/**
 * Signed-out stand-in for either the account or the current-book slot — both
 * need a session before they can show anything, so both open the sign-in modal.
 */
export function NavSignIn({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <SignInButton mode="modal">
      <button type="button" className="app-nav__item">
        <span className="app-nav__icon">{icon}</span>
        <span className="app-nav__label">{label}</span>
      </button>
    </SignInButton>
  )
}
