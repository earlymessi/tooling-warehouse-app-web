import { describe, it, expect } from 'vitest'
import { formatNow, parseIso } from '../../electron/services/time'

describe('time', () => {
  it('formatNow matches ISO 8601 without timezone', () => {
    const s = formatNow(new Date(2026, 5, 26, 14, 30, 0))
    expect(s).toBe('2026-06-26T14:30:00')
  })

  it('parseIso parses local datetime', () => {
    const d = parseIso('2026-06-26T14:30:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(26)
  })
})
