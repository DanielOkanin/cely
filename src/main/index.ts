import { app, shell, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc-handlers'
import { WebRemoteServer } from './services/web-remote-server'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 16 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()
  const services = registerIpcHandlers(mainWindow)

  // Web Remote Server
  const webRemoteServer = new WebRemoteServer(services)

  ipcMain.handle('web-remote:start', async (_event, port?: number) => {
    return webRemoteServer.start(port ?? 3131)
  })

  ipcMain.handle('web-remote:stop', () => {
    webRemoteServer.stop()
  })

  ipcMain.handle('web-remote:status', () => {
    return webRemoteServer.getStatus()
  })

  // Grant microphone access for voice input
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Cmd+N — new chat
  globalShortcut.register('CommandOrControl+N', () => {
    mainWindow.webContents.send('shortcut:new-chat')
  })

  // Cmd+K — command palette
  globalShortcut.register('CommandOrControl+K', () => {
    mainWindow.webContents.send('shortcut:command-palette')
  })

  // Cmd+Shift+E — toggle file explorer
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    mainWindow.webContents.send('shortcut:toggle-explorer')
  })

  // Cmd+1-9 — switch to chat by index
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      mainWindow.webContents.send('shortcut:switch-chat', i - 1)
    })
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Stop web remote server on quit
  app.on('before-quit', () => {
    webRemoteServer.stop()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
