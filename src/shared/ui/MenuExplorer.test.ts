import { describe, expect, it } from 'vitest'
import { formatMenuPrice } from './MenuExplorer'

describe('formatMenuPrice', () => {
  it('formats whole kroner without decimals', () => {
    expect(formatMenuPrice(45)).toMatch(/45/)
  })

  it('accepts numeric strings', () => {
    expect(formatMenuPrice('12.5')).toMatch(/12/)
  })
})
