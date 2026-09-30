import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Context capture
  captureContext: () => ipcRenderer.invoke('capture-context'),
  
  // Overlay control
  onContextChanged: (callback: (context: string) => void) => {
    ipcRenderer.on('context-changed', (_, data) => callback(data.context))
    return () => ipcRenderer.removeAllListeners('context-changed')
  },
  
  onFocusInput: (callback: () => void) => {
    ipcRenderer.on('focus-input', callback)
    return () => ipcRenderer.removeAllListeners('focus-input')
  },
  
  // Window controls
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  // Notify main process overlay is ready
  ready: () => ipcRenderer.send('overlay-ready'),
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>
      captureContext: () => Promise<string>
      onContextChanged: (callback: (context: string) => void) => () => void
      onFocusInput: (callback: () => void) => () => void
      minimize: () => void
      close: () => void
      ready: () => void
    }
  }
}