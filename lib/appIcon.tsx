import { ImageResponse } from 'next/og'

/**
 * The installed-app mark: a gold "L" on the site's ink background.
 *
 * `maskable` renders the same mark inside the 80% safe zone Android crops to,
 * so a launcher can round or squircle the icon without clipping the letter.
 */
export function renderAppIcon(size: number, maskable = false) {
  const glyphSize = Math.round(size * (maskable ? 0.46 : 0.62))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1714',
          color: '#c9a84c',
          fontSize: glyphSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        L
      </div>
    ),
    { width: size, height: size }
  )
}
