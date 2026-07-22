import fs from 'node:fs'

export const DATA_ROOT = 'C:\\tooling-warehouse-db'
export const DB_FILE = `${DATA_ROOT}\\data\\tooling.db`
export const BACKUP_DIR = `${DATA_ROOT}\\backup`
export const EXPORT_DIR = `${DATA_ROOT}\\export`
export const LOGS_DIR = `${DATA_ROOT}\\logs`

const DIRS = [
  `${DATA_ROOT}\\data`,
  BACKUP_DIR,
  EXPORT_DIR,
  LOGS_DIR,
]

export function ensureDataDirs(): void {
  for (const dir of DIRS) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function getPathsInfo() {
  return {
    dataRoot: DATA_ROOT,
    dbFile: DB_FILE,
    backupDir: BACKUP_DIR,
    exportDir: EXPORT_DIR,
    logsDir: LOGS_DIR,
  }
}
