#!/usr/bin/env node
/**
 * Fail the build if the PWA service worker was not emitted.
 * TanStack Start historically skipped vite-plugin-pwa SW generation.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  path.join(root, 'dist', 'client', 'sw.js'),
  path.join(root, '.output', 'public', 'sw.js'),
]

const found = candidates.find((file) => fs.existsSync(file))
if (!found) {
  console.error(
    '[verify-pwa] Missing sw.js. Expected one of:\n' +
      candidates.map((c) => `  - ${path.relative(root, c)}`).join('\n'),
  )
  process.exit(1)
}

const manifestCandidates = [
  path.join(path.dirname(found), 'manifest.webmanifest'),
  path.join(root, '.output', 'public', 'manifest.webmanifest'),
  path.join(root, 'dist', 'client', 'manifest.webmanifest'),
]
const manifest = manifestCandidates.find((file) => fs.existsSync(file))
if (!manifest) {
  console.error('[verify-pwa] Missing manifest.webmanifest next to sw.js')
  process.exit(1)
}

const raw = fs.readFileSync(manifest, 'utf8')
const data = JSON.parse(raw)
const icons = data.icons ?? []
const has192 = icons.some((i) => i.sizes === '192x192')
const has512 = icons.some((i) => i.sizes === '512x512')
if (!has192 || !has512) {
  console.error(
    '[verify-pwa] Manifest must include 192x192 and 512x512 icons. Found:',
    icons.map((i) => i.sizes).join(', ') || '(none)',
  )
  process.exit(1)
}

const swRaw = fs.readFileSync(found, 'utf8')
if (!/precacheAndRoute\(\[/.test(swRaw)) {
  console.error('[verify-pwa] sw.js does not look like a Workbox precache SW')
  process.exit(1)
}
if (!swRaw.includes('assets/')) {
  console.error(
    '[verify-pwa] sw.js precache is missing hashed assets/ — shell may not work offline',
  )
  process.exit(1)
}

console.log(`[verify-pwa] OK — ${path.relative(root, found)}`)
