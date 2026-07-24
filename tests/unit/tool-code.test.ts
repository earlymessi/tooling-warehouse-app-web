import { describe, expect, it } from 'vitest'
import {
  generateNextToolCodes,
  incrementToolCode,
  parseToolCodeSequence,
} from '../../electron/services/toolCode'

describe('toolCode', () => {
  it('parses and increments padded suffix', () => {
    expect(parseToolCodeSequence('LG-GZQ-057')).toEqual({
      prefix: 'LG-GZQ-',
      num: 57,
      width: 3,
    })
    expect(incrementToolCode('LG-GZQ-057')).toBe('LG-GZQ-058')
    expect(incrementToolCode('LG-GZQ-099')).toBe('LG-GZQ-100')
  })

  it('generates a consecutive sequence without db', () => {
    expect(generateNextToolCodes(null, 3, ['LG-GZQ-057'])).toEqual([
      'LG-GZQ-001',
      'LG-GZQ-002',
      'LG-GZQ-003',
    ])
  })

  it('skips reserved codes when generating', () => {
    expect(generateNextToolCodes(null, 2, ['LG-GZQ-001', 'LG-GZQ-002'])).toEqual([
      'LG-GZQ-003',
      'LG-GZQ-004',
    ])
  })
})
