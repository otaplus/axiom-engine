import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { abortAll, abortChat, listModels, streamChat, testConnection } from './ai'
import { getPublicSettings, saveSettings } from './settings'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  installUpdate,
  openReleasePage,
  startAutoUpdater
} from './updater'

if (process.env.AXIOM_USER_DATA) {
  app.setPath('userData', process.env.AXIOM_USER_DATA)
}
if (process.env.AXIOM_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const isLinux = process.platform === 'linux'
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    backgroundColor: '#070a11',
    title: 'Axiom Engine',
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(__dirname, '../../build/icon.png'),
    frame: isLinux ? false : true,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#070a11',
            symbolColor: '#94a3b8',
            height: 40
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  Menu.setApplicationMenu(null)
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    abortAll()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL()
    if (current && url !== current) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => getPublicSettings())
  ipcMain.handle('settings:save', (_event, payload) => saveSettings(payload ?? {}))
  ipcMain.handle('settings:test', () => testConnection())
  ipcMain.handle('settings:models', () => listModels())
  ipcMain.handle('ai:start', (event, request) => {
    void streamChat(event, request)
    return { ok: true }
  })
  ipcMain.handle('ai:abort', (_event, requestId: string) => {
    abortChat(requestId)
    return { ok: true }
  })

  ipcMain.handle('update:get-state', () => getUpdateState())
  ipcMain.handle('update:check', () => checkForUpdates(true))
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => installUpdate())
  ipcMain.handle('update:open-release', () => openReleasePage())

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return window.isMaximized()
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('project:open', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Abrir proyecto de Axiom',
      filters: [
        { name: 'Proyecto Axiom', extensions: ['axiom', 'json'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    const content = await readFile(path, 'utf8')
    return { path, name: basename(path), content }
  })

  ipcMain.handle('project:save', async (_event, payload: { content: string; path?: string; suggestedName?: string }) => {
    if (!mainWindow) return null
    let target = payload.path
    if (!target) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Guardar proyecto de Axiom',
        defaultPath: `${(payload.suggestedName || 'mi-juego').replace(/[\\/:*?"<>|]/g, '-')}.axiom`,
        filters: [{ name: 'Proyecto Axiom', extensions: ['axiom'] }]
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath
    }
    await writeFile(target, payload.content, 'utf8')
    return { path: target, name: basename(target) }
  })

  ipcMain.handle('project:saveAs', async (_event, payload: { content: string; suggestedName?: string }) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar proyecto como…',
      defaultPath: `${(payload.suggestedName || 'mi-juego').replace(/[\\/:*?"<>|]/g, '-')}.axiom`,
      filters: [{ name: 'Proyecto Axiom', extensions: ['axiom'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, payload.content, 'utf8')
    return { path: result.filePath, name: basename(result.filePath) }
  })

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) return { ok: false }
    await shell.openExternal(url)
    return { ok: true }
  })

  ipcMain.handle('app:versions', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(() => {
    registerIpc()
    createWindow()
    startAutoUpdater()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  app.on('window-all-closed', () => {
    abortAll()
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', () => abortAll())
}
