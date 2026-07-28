import { renderAppIcon } from '@/lib/appIcon'

// Next injects <link rel="apple-touch-icon"> for this file automatically.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return renderAppIcon(180)
}
