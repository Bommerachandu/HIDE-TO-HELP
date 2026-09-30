import React from 'react'
import { Message } from '../types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export function MessageList({ messages, isLoading, messagesEndRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p>Ask me anything about your current context</p>
        <span className="hint">Context: Active window title • Press Cmd+Shift+Q for quick ask</span>
      </div>
    )
  }

  return (
    <div className="messages-list">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <MessageBubble
          message={{
            id: 'loading',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          }}
        />
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}