import { Model } from '../types'

interface ModelSelectorProps {
  models: Model[]
  selectedModel: string
  onSelect: (modelId: string) => void
  onClose: () => void
}

export function ModelSelector({ models, selectedModel, onSelect, onClose }: ModelSelectorProps) {
  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, Model[]>)

  return (
    <div className="model-selector-overlay" onClick={onClose}>
      <div className="model-selector" onClick={(e) => e.stopPropagation()}>
        <div className="model-selector-header">
          <h3>Select Model</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <div key={provider} className="model-group">
            <div className="provider-label">{provider.toUpperCase()}</div>
            {providerModels.map((model) => (
              <button
                key={model.id}
                className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
                onClick={() => { onSelect(model.id); onClose(); }}
              >
                <div className="model-info">
                  <span className="model-name">{model.name}</span>
                  {model.description && <span className="model-desc">{model.description}</span>}
                </div>
                {selectedModel === model.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        ))}
        
        {models.length === 0 && (
          <div className="no-models">
            <p>No models found</p>
            <span>Start Ollama or configure API keys in settings</span>
          </div>
        )}
      </div>
    </div>
  )
}