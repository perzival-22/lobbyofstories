import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  // The body is a locked frame, so this screen brings its own scroll tube —
  // Clerk's card can outgrow a short viewport.
  return (
    <div className="app-scroll" style={{ background: 'var(--ink)' }}>
      <div className="min-h-full flex items-center justify-center p-6">
        <SignIn />
      </div>
    </div>
  )
}
