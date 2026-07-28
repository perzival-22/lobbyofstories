import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="app-scroll" style={{ background: 'var(--ink)' }}>
      <div className="min-h-full flex items-center justify-center p-6">
        <SignUp />
      </div>
    </div>
  )
}
