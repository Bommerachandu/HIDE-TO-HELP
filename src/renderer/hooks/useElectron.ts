import { useEffect } from 'react'

export function useElectron() {
  const minimize = () => {
    window.electronAPI?.minimize()
  }

  const close = () => {
    window.electronAPI?.close()
  }

  const onFocusInput = (callback: () => void) => {
    return window.electronAPI?.onFocusInput(callback) || (() => {})
  }

  const captureContext = async (): Promise<string> => {
    return window.electronAPI?.captureContext() || ''
  }

  const ready = () => {
    window.electronAPI?.ready()
  }

  useEffect(() => {
    ready()
  }, [])

  return { minimize, close, onFocusInput, captureContext, ready }
}