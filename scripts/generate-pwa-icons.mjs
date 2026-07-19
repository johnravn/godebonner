#!/usr/bin/env node
/**
 * Generate square PWA / Apple touch icons from the filled brand circle logo.
 * Requires ImageMagick (`magick` or `convert`) on PATH.
 *
 * iPhone uses only apple-touch-icon (not the web manifest), so that asset must
 * be opaque PNG24, tightly cropped, and large enough to read on the home screen.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
/** Filled tan circle — line-art-only sirkel_v3.png is nearly invisible on solid fills. */
const source = path.join(publicDir, 'godebonner_sirkel_v3_oransje.png')
/** Classic Win95 material grey (not desktop teal) */
const iconBg = '#C0C0C0'

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

/**
 * Solid Win95-grey canvas + trimmed logo centered. PNG24 / no alpha (iOS fills
 * transparency with black).
 * @param {string} bin
 * @param {number} canvas
 * @param {number} logo — logo diameter in px (after trim)
 * @param {string} out
 */
function writeIcon(bin, canvas, logo, out) {
  run(bin, [
    '-size',
    `${canvas}x${canvas}`,
    `xc:${iconBg}`,
    '(',
    source,
    '-trim',
    '+repage',
    '-resize',
    `${logo}x${logo}`,
    ')',
    '-gravity',
    'center',
    '-compose',
    'over',
    '-composite',
    '-alpha',
    'off',
    `PNG24:${out}`,
  ])
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

  // "any" / Apple: fill most of the square (iOS applies its own mask)
  writeIcon(bin, 192, 168, outs.any192)
  writeIcon(bin, 512, 448, outs.any512)
  writeIcon(bin, 180, 162, outs.apple180)

  // Maskable: ~60% safe zone for Android adaptive icons
  writeIcon(bin, 512, 307, outs.maskable512)

  console.log('Generated PWA icons:')
  for (const file of Object.values(outs)) {
    console.log(`  ${path.relative(root, file)}`)
  }
}

main()
