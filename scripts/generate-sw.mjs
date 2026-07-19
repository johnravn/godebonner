#!/usr/bin/env node
/**
 * Post-build Workbox generateSW against the Nitro / Vite public output.
 * vite-plugin-pwa often runs before TanStack Start finishes writing assets;
 * this pass guarantees JS/CSS + shell are precached in the deployable folder.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSW } from 'workbox-build'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Prefer Nitro deploy outputs, then legacy dist/client. */
const clientDirCandidates = [
  path.join(root, '.vercel', 'output', 'static'),
  path.join(root, '.output', 'public'),
  path.join(root, 'dist', 'client'),
]

const clientDir = clientDirCandidates.find((dir) => fs.existsSync(dir))

if (!clientDir) {
  console.error(
    '[generate-sw] Missing public output. Expected one of:\n' +
      clientDirCandidates.map((c) => `  - ${path.relative(root, c)}`).join('\n'),
  )
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
  `[generate-sw] Precached ${count} files (${(size / 1024).toFixed(1)} KiB) → ${path.relative(root, clientDir)}`,
)
