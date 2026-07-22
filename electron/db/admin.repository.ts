import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { formatNow } from '../services/time'

export interface AdminUser {
  id: number
  username: string
  password_hash: string
  display_name: string | null
  created_at: string
  updated_at: string
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(`tooling-warehouse:${password}`).digest('hex')
}

export function findByUsername(db: Database.Database, username: string): AdminUser | null {
  const row = db.prepare('SELECT * FROM admin_user WHERE username = ?').get(username.trim())
  return (row as AdminUser | undefined) ?? null
}

export function create(
  db: Database.Database,
  username: string,
  passwordHash: string,
  displayName?: string,
): AdminUser {
  const now = formatNow()
  const result = db
    .prepare(
      `INSERT INTO admin_user (username, password_hash, display_name, created_at, updated_at)
       VALUES (@username, @password_hash, @display_name, @created_at, @updated_at)`,
    )
    .run({
      username: username.trim(),
      password_hash: passwordHash,
      display_name: displayName ?? '管理员',
      created_at: now,
      updated_at: now,
    })
  return db.prepare('SELECT * FROM admin_user WHERE id = ?').get(result.lastInsertRowid) as AdminUser
}

export function countAll(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as c FROM admin_user').get() as { c: number }
  return row.c
}
