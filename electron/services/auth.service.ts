import type Database from 'better-sqlite3'
import * as adminRepo from '../db/admin.repository'

export function ensureDefaultAdmin(db: Database.Database): void {
  const existing = adminRepo.findByUsername(db, 'admin')
  if (!existing) {
    adminRepo.create(db, 'admin', adminRepo.hashPassword('amec'), '系统管理员')
  }
}

export function login(
  db: Database.Database,
  username: string,
  password: string,
): { username: string; displayName: string } {
  const user = adminRepo.findByUsername(db, username)
  if (!user) throw new Error('AUTH_FAILED: 账号或密码错误')
  const hash = adminRepo.hashPassword(password)
  if (hash !== user.password_hash) throw new Error('AUTH_FAILED: 账号或密码错误')
  return { username: user.username, displayName: user.display_name ?? '管理员' }
}
