import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'node:path'
import { ensureDataDirs } from './paths'
import { initDatabase, getDb } from './db'
import { ensureDefaultAdmin } from './services/auth.service'
import { ensureDefaultEmployees } from './services/employee.service'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(null)
  mainWindow.setMenuBarVisibility(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    ensureDataDirs()
    initDatabase()
    ensureDefaultAdmin(getDb())
    ensureDefaultEmployees(getDb())
    registerIpcHandlers(ipcMain)
    createWindow()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('应用启动失败:', err)
    dialog.showErrorBox('启动失败', `数据库初始化失败，请重新安装或联系管理员。\n\n${message}`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
