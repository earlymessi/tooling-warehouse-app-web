import { describe, it, expect } from 'vitest'
import { initTestDatabase } from '../../electron/db'
import { ensureDefaultAdmin, login } from '../../electron/services/auth.service'
import * as adminRepo from '../../electron/db/admin.repository'

describe('auth.service', () => {
  it('default admin can login with admin/amec', () => {
    const db = initTestDatabase()
    ensureDefaultAdmin(db)
    const result = login(db, 'admin', 'amec')
    expect(result.username).toBe('admin')
    expect(login(db, 'admin', 'wrong')).toThrow()
    db.close()
  })

  it('stores password as hash not plain text', () => {
    const db = initTestDatabase()
    ensureDefaultAdmin(db)
    const user = adminRepo.findByUsername(db, 'admin')!
    expect(user.password_hash).not.toBe('amec')
    expect(user.password_hash).toBe(adminRepo.hashPassword('amec'))
    db.close()
  })
})
