interface ContextBadgeProps {
  context: string
}

export function ContextBadge({ context }: ContextBadgeProps) {
  if (!context || context === 'Loading...') return null

  const truncated = context.length > 60 ? context.slice(0, 57) + '...' : context

  return (
    <div className="context-badge" title={context}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
      <span>{truncated}</span>
    </div>
  )
}