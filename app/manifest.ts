import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lobby of Stories',
    short_name: 'Lobby',
    description: 'A personal library of original serialized fiction.',
    // The landing page is a one-off cover animation; an installed app should
    // open straight into the library.
    start_url: '/discover',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#1a1714',
    theme_color: '#1a1714',
    categories: ['books', 'entertainment', 'education'],
    icons: [
      { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/app-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Discover', short_name: 'Discover', url: '/discover' },
      { name: 'My Library', short_name: 'Library', url: '/library' },
    ],
  }
}
