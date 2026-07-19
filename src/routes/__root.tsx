import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Button, Frame } from '@react95/core'
import { AuthProvider } from '#/app/providers/AuthProvider'
import { OfflineBanner } from '#/shared/pwa/OfflineBanner'
import { PwaInstallDialog } from '#/shared/pwa/PwaInstallDialog'
import { PwaProvider } from '#/shared/pwa/PwaProvider'
import { PwaUpdateDialog } from '#/shared/pwa/PwaUpdateDialog'
import '@react95/core/GlobalStyle'
import '@react95/core/themes/win95.css'
import '#/styles.css'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Godebonner' },
      { name: 'description', content: 'Slå opp gratiskuponger med telefonnummer' },
      { name: 'theme-color', content: '#008080' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      { name: 'apple-mobile-web-app-title', content: 'Godebonner' },
      { property: 'og:image', content: '/logo1080.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        href: '/pwa-192x192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        href: '/pwa-512x512.png',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <AuthProvider>
      <PwaProvider>
        <Outlet />
        <OfflineBanner />
        <PwaUpdateDialog />
        <PwaInstallDialog />
      </PwaProvider>
    </AuthProvider>
  )
}

function NotFoundComponent() {
  return (
    <div className="win95-desktop-surface" style={{ placeItems: 'center' }}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$4"
        display="flex"
        flexDirection="column"
        gap="$3"
        style={{ maxWidth: 360, width: 'min(100%, 360px)' }}
      >
        <strong>Siden finnes ikke</strong>
        <p style={{ margin: 0 }}>
          Adressen du åpnet matcher ingen side i Godebonner.
        </p>
        <Link to="/" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
          <Button>Tilbake til skrivebordet</Button>
        </Link>
      </Frame>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
