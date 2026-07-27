import { describe, expect, it } from 'vitest'
import { normalizeCodeField, normalizeSearchKeyword } from '../../src/utils/codeField'

describe('codeField', () => {
  it('normalizes asset codes to uppercase ASCII', () => {
    expect(normalizeCodeField('lg-gzq-057')).toBe('LG-GZQ-057')
    expect(normalizeCodeField('2-颚2')).toBe('2-2')
    expect(normalizeCodeField('2-E2')).toBe('2-E2')
  })

  it('keeps Chinese in search keywords but uppercases latin letters', () => {
    expect(normalizeSearchKeyword('lg夹具a')).toBe('LG夹具A')
  })
})
