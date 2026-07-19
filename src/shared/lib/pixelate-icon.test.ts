import { describe, expect, it } from 'vitest'
import {
  EMOJI_MAX_GRAPHEMES,
  ICON_UPLOAD_MAX_BYTES,
  IconUploadError,
  normalizeEmojiInput,
  processIconUpload,
} from './pixelate-icon'

describe('processIconUpload validation', () => {
  it('rejects unsupported MIME types', async () => {
    const file = new File(['x'], 'x.bmp', { type: 'image/bmp' })
    await expect(processIconUpload(file)).rejects.toBeInstanceOf(IconUploadError)
    await expect(processIconUpload(file)).rejects.toThrow(/filtype/i)
  })

  it('rejects files larger than the max size', async () => {
    const big = new Uint8Array(ICON_UPLOAD_MAX_BYTES + 1)
    const file = new File([big], 'big.png', { type: 'image/png' })
    await expect(processIconUpload(file)).rejects.toThrow(/for stor/i)
  })
})

describe('normalizeEmojiInput', () => {
  it('trims and accepts a single emoji', () => {
    expect(normalizeEmojiInput('  ☕  ')).toBe('☕')
    expect(normalizeEmojiInput('🥐')).toBe('🥐')
  })

  it('keeps ZWJ sequences as one grapheme', () => {
    expect(normalizeEmojiInput('👨‍👩‍👧')).toBe('👨‍👩‍👧')
  })

  it('allows a few graphemes', () => {
    expect(normalizeEmojiInput('☕🥐')).toBe('☕🥐')
  })

  it('rejects empty input', () => {
    expect(() => normalizeEmojiInput('')).toThrow(/emoji/i)
    expect(() => normalizeEmojiInput('   ')).toThrow(/emoji/i)
  })

  it('rejects plain ASCII', () => {
    expect(() => normalizeEmojiInput('ab')).toThrow(/emoji/i)
    expect(() => normalizeEmojiInput('A')).toThrow(/emoji/i)
  })

  it('rejects too many graphemes', () => {
    const tooMany = '😀'.repeat(EMOJI_MAX_GRAPHEMES + 1)
    expect(() => normalizeEmojiInput(tooMany)).toThrow(/mange/i)
  })
})
