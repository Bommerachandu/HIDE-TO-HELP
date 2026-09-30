import { app, BrowserWindow, screen, ipcMain, globalShortcut, nativeImage, Tray, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import { WebSocketServer, WebSocket } from 'ws'

// Extend Electron's App type for isQuitting
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}

// Configuration
const CONFIG = {
  overlay: {
    width: 400,
    height: 600,
    margin: 20,
    opacity: 0.95,
  },
  pythonBackend: {
    port: 8765,
    script: path.join(__dirname, '../../python/main.py'),
  },
  shortcuts: {
    toggleOverlay: 'CommandOrControl+Shift+A',
    quickAsk: 'CommandOrControl+Shift+Q',
  },
}

let overlayWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null
let wss: WebSocketServer | null = null
let tray: Tray | null = null
let isOverlayVisible = false
let currentContext: string = ''

// Python backend management
function startPythonBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.platform === 'win32' ? 'python.exe' : 'python3'
    pythonProcess = spawn(pythonPath, [CONFIG.pythonBackend.script], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    pythonProcess.stdout?.on('data', (data) => {
      console.log('[Python]', data.toString().trim())
    })

    pythonProcess.stderr?.on('data', (data) => {
      console.error('[Python Error]', data.toString().trim())
    })

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python backend:', err)
      reject(err)
    })

    pythonProcess.on('exit', (code) => {
      console.log(`Python backend exited with code ${code}`)
      pythonProcess = null
    })

    // Wait a bit for Python to start
    setTimeout(resolve, 2000)
  })
}

function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

// WebSocket server for frontend-backend communication
function startWebSocketServer() {
  wss = new WebSocketServer({ port: CONFIG.pythonBackend.port })

  wss.on('connection', (ws: WebSocket) => {
    console.log('Frontend connected to WebSocket')

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        handleWebSocketMessage(ws, msg)
      } catch (e) {
        console.error('Invalid WS message:', e)
      }
    })

    ws.on('close', () => {
      console.log('Frontend disconnected')
    })

    // Send initial config
    ws.send(JSON.stringify({ type: 'config', payload: CONFIG }))
  })

  console.log(`WebSocket server running on ws://localhost:${CONFIG.pythonBackend.port}`)
}

function handleWebSocketMessage(ws: WebSocket, msg: any) {
  switch (msg.type) {
    case 'ask':
      forwardToPython('ask', msg.payload, ws)
      break
    case 'context_update':
      currentContext = msg.payload.context
      forwardToPython('context_update', msg.payload, ws)
      break
    case 'get_models':
      forwardToPython('get_models', {}, ws)
      break
    case 'switch_model':
      forwardToPython('switch_model', msg.payload, ws)
      break
    default:
      ws.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${msg.type}` }))
  }
}

function forwardToPython(type: string, payload: any, ws: WebSocket) {
  if (pythonProcess && pythonProcess.stdin) {
    pythonProcess.stdin.write(JSON.stringify({ type, payload, wsId: (ws as any).id }) + '\n')
  } else {
    ws.send(JSON.stringify({ type: 'error', payload: 'Python backend not running' }))
  }
}

// Overlay window management
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  overlayWindow = new BrowserWindow({
    width: CONFIG.overlay.width,
    height: CONFIG.overlay.height,
    x: screenWidth - CONFIG.overlay.width - CONFIG.overlay.margin,
    y: CONFIG.overlay.margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    opacity: CONFIG.overlay.opacity,
    backgroundColor: '#00000000',
    hasShadow: true,
    vibrancy: 'under-window', // macOS
    visualEffectState: 'active',
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173')
    overlayWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  overlayWindow.on('blur', () => {
    // Keep overlay on top but don't auto-hide on blur
  })

  overlayWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      hideOverlay()
    }
  })

  // Prevent overlay from being captured in screenshots/recordings (best effort)
  if (process.platform === 'win32') {
    overlayWindow.setContentProtection(true)
  }
}

function showOverlay() {
  if (!overlayWindow) createOverlayWindow()
  overlayWindow?.show()
  overlayWindow?.focus()
  isOverlayVisible = true
  updateTrayMenu()
}

function hideOverlay() {
  overlayWindow?.hide()
  isOverlayVisible = false
  updateTrayMenu()
}

function toggleOverlay() {
  if (isOverlayVisible) hideOverlay()
  else showOverlay()
}

// Context capture - simplified for MVP (active window title)
async function captureContext() {
  // In a full implementation, this would use:
  // - Accessibility API (macOS/Windows) for screen reading
  // - OCR for text extraction
  // - Browser extensions for DOM access
  // - IDE extensions for code context
  
  // For MVP, we'll get the active window title
  const activeWindow = BrowserWindow.getFocusedWindow()
  if (activeWindow && activeWindow !== overlayWindow) {
    return activeWindow.getTitle()
  }
  return 'No active application context'
}

// Global shortcuts
function registerShortcuts() {
  globalShortcut.register(CONFIG.shortcuts.toggleOverlay, () => {
    toggleOverlay()
  })

  globalShortcut.register(CONFIG.shortcuts.quickAsk, async () => {
    if (!isOverlayVisible) {
      showOverlay()
    }
    // Focus the input in the overlay
    overlayWindow?.webContents.send('focus-input')
  })
}

// Tray icon
function createTray() {
  // Create a simple tray icon
  const iconPath = path.join(__dirname, '../../assets/icon.png')
  let icon = nativeImage.createEmpty()
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    // Create a simple colored square as fallback (16x16)
    const buffer = Buffer.alloc(16 * 16 * 4)
    for (let i = 0; i < 16 * 16; i++) {
      const offset = i * 4
      // Indigo color #6366f1
      buffer[offset] = 0x63     // R
      buffer[offset + 1] = 0x66 // G
      buffer[offset + 2] = 0xf1 // B
      buffer[offset + 3] = 0xff // A
    }
    icon = nativeImage.createFromBuffer(buffer, { width: 16, height: 16 })
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  updateTrayMenu()
}

function updateTrayMenu() {
  if (!tray) return
  
  const menu = Menu.buildFromTemplate([
    {
      label: isOverlayVisible ? 'Hide Overlay' : 'Show Overlay',
      click: toggleOverlay,
      accelerator: CONFIG.shortcuts.toggleOverlay,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('Parasitic AI - Background Assistant')
}

// App lifecycle
app.whenReady().then(async () => {
  // Security: Prevent new window creation
  app.on('web-contents-created', (_event, contents) => {
    contents.on('new-window' as any, (e: Event, _url: string) => {
      e.preventDefault()
      // Could open in external browser
    })
  })

  await startPythonBackend()
  startWebSocketServer()
  createOverlayWindow()
  createTray()
  registerShortcuts()

  // Periodic context capture
  setInterval(async () => {
    if (isOverlayVisible && overlayWindow) {
      const context = await captureContext()
      if (context !== currentContext) {
        currentContext = context
        overlayWindow.webContents.send('context-changed', { context })
      }
    }
  }, 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopPythonBackend()
  wss?.close()
})

// Handle Python backend messages (stdout)
process.on('message', (msg: unknown) => {
  const message = msg as { type?: string; payload?: any }
  if (message?.type === 'python_response') {
    // Broadcast to all connected WebSocket clients
    wss?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message.payload))
      }
    })
  }
})

// IPC handlers for renderer
ipcMain.handle('get-config', () => CONFIG)
ipcMain.handle('capture-context', captureContext)
ipcMain.on('overlay-ready', () => {
  console.log('Overlay renderer ready')
})
ipcMain.on('minimize-window', () => {
  overlayWindow?.minimize()
})
ipcMain.on('close-window', () => {
  hideOverlay()
})