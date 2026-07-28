import { renderAppIcon } from '@/lib/appIcon'

// Prerendered at build time — the mark never changes between requests.
export const dynamic = 'force-static'

export function GET() {
  return renderAppIcon(192)
}
