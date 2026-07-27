import type { BrowserWindow } from 'electron'

type KoffiLib = typeof import('koffi')

let immGetContext: ((hwnd: unknown) => unknown) | null = null
let immSetOpenStatus: ((himc: unknown, open: boolean) => boolean) | null = null
let immReleaseContext: ((hwnd: unknown, himc: unknown) => boolean) | null = null
let loadKeyboardLayoutW: ((klid: string, flags: number) => unknown) | null = null
let activateKeyboardLayout: ((hkl: unknown, flags: number) => unknown) | null = null
let initFailed = false

const ENGLISH_KLID = '00000409'
const CHINESE_KLID = '00000804'
const KLF_ACTIVATE = 0x00000001

function hwndFromBuffer(buf: Buffer): number {
  if (buf.length >= 8) {
    return Number(buf.readBigUInt64LE(0))
  }
  return buf.readUInt32LE(0)
}

function initWinIme(): void {
  if (initFailed || process.platform !== 'win32') return
  if (immGetContext) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as KoffiLib
    const imm32 = koffi.load('imm32.dll')
    const user32 = koffi.load('user32.dll')

    immGetContext = imm32.func('void * __stdcall ImmGetContext(void * hWnd)')
    immSetOpenStatus = imm32.func('bool __stdcall ImmSetOpenStatus(void * hIMC, bool fOpen)')
    immReleaseContext = imm32.func('bool __stdcall ImmReleaseContext(void * hWnd, void * hIMC)')
    loadKeyboardLayoutW = user32.func('void * __stdcall LoadKeyboardLayoutW(str16 lpszKLID, uint32 Flags)')
    activateKeyboardLayout = user32.func('void * __stdcall ActivateKeyboardLayout(void * hKL, uint32 Flags)')
  } catch (err) {
    initFailed = true
    console.warn('[winIme] 初始化失败，编号输入将仅做大写转换:', err)
  }
}

function setImeOpen(win: BrowserWindow, open: boolean): void {
  if (!immGetContext || !immSetOpenStatus || !immReleaseContext) return
  const hwnd = hwndFromBuffer(win.getNativeWindowHandle())
  const himc = immGetContext(hwnd)
  if (!himc) return
  try {
    immSetOpenStatus(himc, open)
  } finally {
    immReleaseContext(hwnd, himc)
  }
}

function activateLayout(klid: string): void {
  if (!loadKeyboardLayoutW || !activateKeyboardLayout) return
  const hkl = loadKeyboardLayoutW(klid, KLF_ACTIVATE)
  if (hkl) activateKeyboardLayout(hkl, 0)
}

/** 编号类输入框聚焦：关中文 IME，切到英文键盘布局 */
export function enableEnglishCodeInput(win: BrowserWindow | null): void {
  if (!win || process.platform !== 'win32') return
  initWinIme()
  setImeOpen(win, false)
  activateLayout(ENGLISH_KLID)
}

/** 离开编号类输入框：恢复中文 IME 与常用中文键盘布局 */
export function restoreDefaultInput(win: BrowserWindow | null): void {
  if (!win || process.platform !== 'win32') return
  initWinIme()
  setImeOpen(win, true)
  activateLayout(CHINESE_KLID)
}
