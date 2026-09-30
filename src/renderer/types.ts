export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

export interface Model {
  id: string
  name: string
  provider: 'ollama' | 'openai' | 'anthropic' | 'local'
  description?: string
  contextLength?: number
}

export interface WSMessage {
  type: string
  payload: any
}

export interface AskPayload {
  message: string
  context: string
  model: string
  history: Message[]
}

export interface ContextUpdatePayload {
  context: string
}

export interface SwitchModelPayload {
  model: string
}