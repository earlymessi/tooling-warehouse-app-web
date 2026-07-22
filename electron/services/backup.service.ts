import fs from 'node:fs'
import path from 'node:path'
import { DB_FILE, BACKUP_DIR } from '../paths'
import { formatNow } from './time'

export function backupDatabase(): string {
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  const dest = path.join(BACKUP_DIR, `tooling-${stamp}.db`)
  fs.copyFileSync(DB_FILE, dest)
  return dest
}
