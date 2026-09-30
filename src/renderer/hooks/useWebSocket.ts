import { useState, useEffect, useRef, useCallback } from 'react'
import { WSMessage } from '../types'

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageHandlersRef = useRef<Map<string, (payload: any) => void>>(new Map())

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://localhost:8765`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setConnectionError(null)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionError('Connection failed. Is the Python backend running?')
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        const handler = messageHandlersRef.current.get(msg.type)
        if (handler) {
          handler(msg.payload)
        } else {
          console.log('Unhandled message type:', msg.type, msg.payload)
        }
      } catch (e) {
        console.error('Failed to parse WS message:', e)
      }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('WebSocket not connected, message queued:', msg.type)
    }
  }, [])

  const onMessage = useCallback((type: string, handler: (payload: any) => void) => {
    messageHandlersRef.current.set(type, handler)
    return () => messageHandlersRef.current.delete(type)
  }, [])

  return { sendMessage, isConnected, connectionError, onMessage }
}