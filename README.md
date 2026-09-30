# Parasitic AI - Background AI Assistant

A desktop AI assistant that runs in the background, monitors your active applications, and provides contextual suggestions through an always-on-top floating overlay.

## Features

- 🎯 **Always-on-top floating overlay** - Accessible via `Cmd/Ctrl+Shift+A`
- 🧠 **Context-aware** - Detects active window/application automatically
- 💬 **Streaming responses** - Real-time token streaming from local LLMs
- 🔒 **Privacy-first** - Runs entirely locally with Ollama (no cloud required)
- 🔄 **Multi-model support** - Switch between models instantly
- ⌨️ **Global hotkeys** - Quick access from anywhere
- 🎨 **Modern UI** - Dark theme, smooth animations, responsive design

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Electron +     │ ◄─────────────────► │  Python Backend  │
│  React (UI)     │   ws://localhost:8765 │  (AI Engine)     │
└─────────────────┘                     └──────────────────┘
       │                                         │
       │ Global Shortcuts                        │ Ollama (Local LLMs)
       ▼                                         ▼
┌─────────────────┐                     ┌──────────────────┐
│  OS Integration │                     │  llama3.2,       │
│  (Context,      │                     │  codellama,      │
│   Overlay,      │                     │  mistral, etc.   │
│   Tray)         │                     └──────────────────┘
└─────────────────┘
```

## Prerequisites

1. **Node.js 18+** and **npm**
2. **Python 3.10+**
3. **Ollama** - Install from [ollama.com](https://ollama.com)

```bash
# Install Ollama models (choose one or more)
ollama pull llama3.2          # General purpose (2GB)
ollama pull codellama         # Code specialized (4GB)
ollama pull mistral           # Fast & capable (4GB)
ollama pull phi3              # Small & fast (2GB)
```

## Quick Start

```bash
# 1. Clone and enter directory
cd parasitic-ai

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
npm run python:install
# OR manually:
cd python && pip install -r requirements.txt && cd ..

# 4. Start Ollama (in separate terminal)
ollama serve

# 5. Start development servers
npm run dev
```

This starts:
- Vite dev server (renderer) on `http://localhost:5173`
- Electron main process with overlay window
- Python WebSocket backend on `ws://localhost:8765`

## Usage

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + A` | Toggle overlay |
| `Cmd/Ctrl + Shift + Q` | Quick ask (show overlay + focus input) |
| `Enter` | Send message |
| `Shift + Enter` | New line in input |

## Project Structure

```
parasitic-ai/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Main entry, overlay window, shortcuts
│   │   └── preload.ts        # Secure IPC bridge
│   └── renderer/             # React frontend
│       ├── components/       # UI components
│       ├── hooks/            # Custom React hooks
│       ├── types.ts          # TypeScript types
│       ├── App.tsx           # Main app component
│       ├── main.tsx          # Entry point
│       └── styles.css        # All styles
├── python/
│   ├── main.py               # WebSocket server + AI backend
│   └── requirements.txt      # Python dependencies
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Building for Production

```bash
# Build all
npm run build

# The built app will be in dist/
# For distribution, use electron-builder:
npx electron-builder --win --mac --linux
```

## Configuration

Edit `src/main/main.ts` CONFIG object:

```typescript
const CONFIG = {
  overlay: {
    width: 400,
    height: 600,
    margin: 20,
    opacity: 0.95,
  },
  pythonBackend: {
    port: 8765,
  },
  shortcuts: {
    toggleOverlay: 'CommandOrControl+Shift+A',
    quickAsk: 'CommandOrControl+Shift+Q',
  },
}
```

## Adding More AI Providers

The Python backend supports multiple providers. To add OpenAI/Anthropic:

1. Add API key handling in `python/main.py`
2. Implement `_generate_openai()` / `_generate_anthropic()` methods
3. Add model discovery in `_initialize_models()`

## Troubleshooting

**"No models available"**
- Ensure Ollama is running: `ollama serve`
- Pull a model: `ollama pull llama3.2`
- Restart the app

**Overlay not showing**
- Check Electron DevTools (opens automatically in dev)
- Verify WebSocket connection in Network tab

**Python backend fails to start**
- Run manually: `cd python && python main.py`
- Check for missing dependencies: `pip install -r requirements.txt`

## License

MIT - Feel free to use and modify.

## Roadmap

- [ ] Screen capture / OCR for full context
- [ ] Browser extension for DOM access
- [ ] VS Code extension for code context
- [ ] Voice input (speech-to-text)
- [ ] Plugin system for custom tools
- [ ] Multi-monitor overlay positioning
- [ ] Conversation history persistence