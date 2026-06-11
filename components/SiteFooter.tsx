import Link from 'next/link'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="px-8 py-8 text-center text-xs tracking-wide"
      style={{ borderTop: '1px solid #2a2520', color: 'var(--muted)' }}
    >
      <p className="mb-3">
        &copy; {year} Lobby of Stories. All content is original and all rights are reserved.
      </p>
      <nav className="flex justify-center gap-6">
        <Link href="/terms" className="hover:text-white transition-colors">
          Terms &amp; Conditions
        </Link>
        <a href="mailto:kelvinmusiomi99@gmail.com" className="hover:text-white transition-colors">
          Contact
        </a>
      </nav>
    </footer>
  )
}
