import { describe, it, expect } from 'vitest'
import { DATA_ROOT, DB_FILE, BACKUP_DIR, EXPORT_DIR } from '../../electron/paths'

describe('paths', () => {
  it('uses C drive tooling-warehouse-db root', () => {
    expect(DATA_ROOT).toBe('C:\\tooling-warehouse-db')
    expect(DB_FILE).toBe('C:\\tooling-warehouse-db\\data\\tooling.db')
    expect(BACKUP_DIR).toBe('C:\\tooling-warehouse-db\\backup')
    expect(EXPORT_DIR).toBe('C:\\tooling-warehouse-db\\export')
  })
})
