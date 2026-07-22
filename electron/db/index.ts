import Database from 'better-sqlite3'
import { DB_FILE } from '../paths'
import { SCHEMA_SQL } from './schema'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db
  db = new Database(DB_FILE)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  runMigrations(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initTestDatabase(): Database.Database {
  const testDb = new Database(':memory:')
  testDb.pragma('foreign_keys = ON')
  testDb.exec(SCHEMA_SQL)
  runMigrations(testDb)
  return testDb
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
