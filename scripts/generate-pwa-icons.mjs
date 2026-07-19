#!/usr/bin/env node
/**
 * Generate square PWA / Apple touch icons from the brand circle logo.
 * Requires ImageMagick (`magick` or `convert`) on PATH.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const source = path.join(publicDir, 'godebonner_sirkel_v3.png')
const teal = '#008080'

function findMagickBin() {
  for (const cmd of ['magick', 'convert']) {
    const check = spawnSync(cmd, ['-version'], { encoding: 'utf8' })
    if (check.status === 0) return cmd
  }
  return null
}

/** @param {string} bin @param {string[]} args */
function run(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `Icon generation failed (${bin} ${args.join(' ')}):\n${result.stderr || result.stdout}`,
    )
  }
}

function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source logo: ${source}`)
  }

  const bin = findMagickBin()
  if (!bin) {
    throw new Error(
      'ImageMagick not found. Install it (e.g. brew install imagemagick) and re-run.',
    )
  }

  const outs = {
    any192: path.join(publicDir, 'pwa-192x192.png'),
    any512: path.join(publicDir, 'pwa-512x512.png'),
    maskable512: path.join(publicDir, 'pwa-512x512-maskable.png'),
    apple180: path.join(publicDir, 'apple-touch-icon.png'),
  }

  run(bin, [
    source,
    '-resize',
    '192x192',
    '-background',
    teal,
    '-gravity',
    'center',
    '-extent',
    '192x192',
    outs.any192,
  ])
  run(bin, [
    source,
    '-resize',
    '512x512',
    '-background',
    teal,
    '-gravity',
    'center',
    '-extent',
    '512x512',
    outs.any512,
  ])

  // Maskable: ~60% safe zone with teal padding (Android adaptive icons)
  run(bin, [
    '-size',
    '512x512',
    `xc:${teal}`,
    '(',
    source,
    '-resize',
    '307x307',
    ')',
    '-gravity',
    'center',
    '-composite',
    outs.maskable512,
  ])

  run(bin, [
    source,
    '-resize',
    '180x180',
    '-background',
    teal,
    '-gravity',
    'center',
    '-extent',
    '180x180',
    outs.apple180,
  ])

  console.log('Generated PWA icons:')
  for (const file of Object.values(outs)) {
    console.log(`  ${path.relative(root, file)}`)
  }
}

main()
