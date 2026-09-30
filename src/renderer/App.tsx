import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageList } from './components/MessageList'
import { InputArea } from './components/InputArea'
import { Header } from './components/Header'
import { ContextBadge } from './components/ContextBadge'
import { ModelSelector } from './components/ModelSelector'
import { useWebSocket } from './hooks/useWebSocket'
import { useElectron } from './hooks/useElectron'
import { Message, Model } from './types'

export function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentContext, setCurrentContext] = useState<string>('Loading...')
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, isConnected, connectionError, onMessage } = useWebSocket()
  const { minimize, close, onFocusInput } = useElectron()

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input on mount and when triggered from main process
  useEffect(() => {
    inputRef.current?.focus()
    const cleanup = onFocusInput(() => {
      inputRef.current?.focus()
    })
    return cleanup
  }, [onFocusInput])

  // Handle context updates from main process
  useEffect(() => {
    const { electronAPI } = window as any
    if (electronAPI?.onContextChanged) {
      const cleanup = electronAPI.onContextChanged(setCurrentContext)
      return cleanup
    }
  }, [])

  // Fetch models on connect
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_models', payload: {} })
    }
  }, [isConnected, sendMessage])

  // Set up WebSocket message handlers
  useEffect(() => {
    const unsubStreamStart = onMessage('stream_start', () => {
      setIsLoading(true)
    })
    
    const unsubStreamChunk = onMessage('stream_chunk', (payload: { content: string }) => {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + payload.content }]
        } else {
          return [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: payload.content,
            timestamp: new Date(),
            isStreaming: true,
          }]
        }
      })
    })
    
    const unsubStreamComplete = onMessage('stream_complete', (payload: { content: string }) => {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          return [...prev.slice(0, -1), { ...lastMsg, content: payload.content, isStreaming: false }]
        }
        return prev
      })
      setIsLoading(false)
    })
    
    const unsubModelsList = onMessage('models_list', (payload: { models: Model[]; current: string }) => {
      setModels(payload.models)
      if (!selectedModel && payload.current) {
        setSelectedModel(payload.current)
      }
    })
    
    const unsubError = onMessage('error', (payload: string) => {
      console.error('Backend error:', payload)
      setIsLoading(false)
    })

    return () => {
      unsubStreamStart()
      unsubStreamChunk()
      unsubStreamComplete()
      unsubModelsList()
      unsubError()
    }
  }, [onMessage, selectedModel])

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Send to backend with context
    sendMessage({
      type: 'ask',
      payload: {
        message: text,
        context: currentContext,
        model: selectedModel,
        history: messages.slice(-10), // Last 10 messages for context
      },
    })
  }

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId)
    sendMessage({ type: 'switch_model', payload: { model: modelId } })
  }

  const handleMinimize = () => {
    setIsMinimized(true)
    minimize()
  }

  const handleClose = () => {
    close()
  }

  if (isMinimized) {
    return null // Hidden, will be shown via main process
  }

  return (
    <div className="overlay-container">
      <Header
        onMinimize={handleMinimize}
        onClose={handleClose}
        onSettingsToggle={() => setSettingsOpen(!settingsOpen)}
        isConnected={isConnected}
        connectionError={connectionError}
      />
      
      <ContextBadge context={currentContext} />
      
      <div className="messages-area">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />
      </div>
      
      {settingsOpen && (
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          onSelect={handleModelSelect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      
      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        inputRef={inputRef}
        placeholder={isConnected ? "Ask anything..." : "Connecting..."}
        disabled={!isConnected}
      />
    </div>
  )
}

export default App