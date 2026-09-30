import React, { useEffect, KeyboardEvent } from 'react'

interface InputAreaProps {
  input: string
  setInput: (value: string) => void
  onSend: (text: string) => void
  isLoading: boolean
  inputRef: React.RefObject<HTMLTextAreaElement>
  placeholder: string
  disabled: boolean
}

export function InputArea({ 
  input, 
  setInput, 
  onSend, 
  isLoading, 
  inputRef, 
  placeholder, 
  disabled 
}: InputAreaProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        onSend(input)
      }
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px'
    }
  }, [input])

  return (
    <div className="input-area">
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className="input-textarea"
        aria-label="Ask Parasitic AI"
      />
      <button
        className="send-btn"
        onClick={() => input.trim() && !isLoading && onSend(input)}
        disabled={!input.trim() || isLoading || disabled}
        aria-label="Send"
      >
        {isLoading ? (
          <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        )}
      </button>
      <div className="input-hint">
        {disabled ? 'Connecting to backend...' : 'Enter to send • Shift+Enter for new line'}
      </div>
    </div>
  )
}