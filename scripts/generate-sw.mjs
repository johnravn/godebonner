#!/usr/bin/env node
/**
 * Post-build Workbox generateSW against dist/client.
 * vite-plugin-pwa often runs before TanStack Start finishes writing assets;
 * this pass guarantees JS/CSS + shell are precached.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSW } from 'workbox-build'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientDir = path.join(root, 'dist', 'client')

if (!fs.existsSync(clientDir)) {
  console.error('[generate-sw] Missing dist/client — run vite build first')
  process.exit(1)
}

const shellPath = path.join(clientDir, '_shell.html')
const additionalManifestEntries = []
if (fs.existsSync(shellPath)) {
  additionalManifestEntries.push({
    url: '/_shell.html',
    revision: fs.statSync(shellPath).mtimeMs.toString(36),
  })
}

const { count, size, warnings } = await generateSW({
  globDirectory: clientDir,
  globPatterns: [
    '**/*.{js,css,ico,svg,woff2,webmanifest}',
    'pwa-*.png',
    'apple-touch-icon.png',
    'logo1080.png',
  ],
  globIgnores: ['**/react95-icons/**', 'sw.js', 'workbox-*.js'],
  swDest: path.join(clientDir, 'sw.js'),
  navigateFallback: '/_shell.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/_serverFn\//],
  additionalManifestEntries,
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.hostname.endsWith('supabase.co') ||
        url.hostname.endsWith('supabase.in'),
      handler: 'NetworkOnly',
    },
  ],
  skipWaiting: false,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
})

for (const warning of warnings) {
  console.warn('[generate-sw]', warning)
}

console.log(
  `[generate-sw] Precached ${count} files (${(size / 1024).toFixed(1)} KiB)`,
)
