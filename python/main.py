# Parasitic AI - Python Backend
# Handles AI integration with Ollama (free local LLMs)

import asyncio
import json
import sys
import os
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass, asdict
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import optional dependencies
try:
    import ollama
    HAS_OLLAMA = True
except ImportError:
    HAS_OLLAMA = False
    logger.warning("Ollama not installed. Install with: pip install ollama")

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False
    logger.warning("Websockets not installed. Install with: pip install websockets")


@dataclass
class ModelInfo:
    id: str
    name: str
    provider: str
    description: str = ""
    context_length: int = 4096


class AIBackend:
    """Manages AI model connections and inference"""
    
    def __init__(self):
        self.models: Dict[str, ModelInfo] = {}
        self.current_model: Optional[str] = None
        self.ollama_client = None
        self._initialize_models()
    
    def _initialize_models(self):
        """Discover available models"""
        # Ollama models
        if HAS_OLLAMA:
            try:
                self.ollama_client = ollama.Client()
                models = self.ollama_client.list()
                for m in models.get('models', []):
                    model_id = m['name']
                    self.models[model_id] = ModelInfo(
                        id=model_id,
                        name=model_id,
                        provider='ollama',
                        description=f"Ollama local model ({m.get('size', 0) // 1024 // 1024}MB)",
                        context_length=4096  # Default, varies by model
                    )
                logger.info(f"Found {len(self.models)} Ollama models")
            except Exception as e:
                logger.warning(f"Could not connect to Ollama: {e}")
        
        # If no models found, add placeholder
        if not self.models:
            self.models['none'] = ModelInfo(
                id='none',
                name='No models available',
                provider='none',
                description='Install Ollama and pull a model: ollama pull llama3.2'
            )
        
        # Set default model
        if self.models:
            self.current_model = next(iter(self.models))
    
    def get_models(self) -> List[ModelInfo]:
        return list(self.models.values())
    
    def set_model(self, model_id: str) -> bool:
        if model_id in self.models:
            self.current_model = model_id
            logger.info(f"Switched to model: {model_id}")
            return True
        return False
    
    async def generate_stream(self, prompt: str, context: str = "", history: List[Dict] = None) -> AsyncGenerator[str, None]:
        """Generate streaming response from current model"""
        if not self.current_model or self.current_model == 'none':
            yield "No AI model available. Please install Ollama and pull a model (e.g., `ollama pull llama3.2`)."
            return
        
        model_info = self.models.get(self.current_model)
        if not model_info:
            yield f"Model {self.current_model} not found"
            return
        
        # Build full prompt with context and history
        full_prompt = self._build_prompt(prompt, context, history or [])
        
        try:
            if model_info.provider == 'ollama' and HAS_OLLAMA:
                async for chunk in self._generate_ollama(full_prompt):
                    yield chunk
            else:
                yield "Model provider not available"
        except Exception as e:
            logger.error(f"Generation error: {e}")
            yield f"Error: {str(e)}"
    
    def _build_prompt(self, prompt: str, context: str, history: List[Dict]) -> str:
        """Build the full prompt with system context and history"""
        system = """You are Parasitic AI, a helpful coding assistant that runs alongside the user's applications.
You have access to the current application context and can help with coding, debugging, writing, and analysis.
Be concise, practical, and proactive. Use markdown for code and formatting."""
        
        parts = [f"System: {system}"]
        
        if context:
            parts.append(f"Current Context: {context}")
        
        # Add recent history
        for msg in history[-6:]:  # Last 6 messages
            role = "User" if msg.get('role') == 'user' else "Assistant"
            content = msg.get('content', '')[:500]  # Truncate long messages
            parts.append(f"{role}: {content}")
        
        parts.append(f"User: {prompt}")
        parts.append("Assistant:")
        
        return "\n\n".join(parts)
    
    async def _generate_ollama(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream from Ollama"""
        if not self.ollama_client or not self.current_model:
            return
        
        try:
            stream = self.ollama_client.generate(
                model=self.current_model,
                prompt=prompt,
                stream=True,
                options={
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'num_ctx': 4096,
                }
            )
            
            for chunk in stream:
                if 'response' in chunk:
                    yield chunk['response']
                if chunk.get('done', False):
                    break
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            yield f"\n[Error: {str(e)}]"


class WebSocketHandler:
    """Handles WebSocket communication with Electron frontend"""
    
    def __init__(self, ai_backend: AIBackend):
        self.ai_backend = ai_backend
        self.clients: Dict[int, Any] = {}
        self.client_counter = 0
    
    async def handle_client(self, websocket):
        client_id = self.client_counter
        self.client_counter += 1
        self.clients[client_id] = websocket
        logger.info(f"Client {client_id} connected. Total: {len(self.clients)}")
        
        try:
            async for message in websocket:
                await self._process_message(client_id, message)
        except Exception as e:
            logger.error(f"Client {client_id} error: {e}")
        finally:
            self.clients.pop(client_id, None)
            logger.info(f"Client {client_id} disconnected. Total: {len(self.clients)}")
    
    async def _process_message(self, client_id: int, message: str):
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            payload = data.get('payload', {})
            ws_id = data.get('wsId', client_id)
            
            client_ws = self.clients.get(ws_id)
            if not client_ws:
                return
            
            if msg_type == 'ask':
                await self._handle_ask(client_ws, payload)
            elif msg_type == 'get_models':
                await self._handle_get_models(client_ws)
            elif msg_type == 'switch_model':
                await self._handle_switch_model(client_ws, payload)
            elif msg_type == 'context_update':
                # Context updates are handled by the frontend
                pass
            else:
                await self._send(client_ws, 'error', f"Unknown message type: {msg_type}")
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Message processing error: {e}")
    
    async def _handle_ask(self, ws, payload: dict):
        """Handle ask request with streaming response"""
        prompt = payload.get('message', '')
        context = payload.get('context', '')
        history = payload.get('history', [])
        model = payload.get('model', '')
        
        if model and model != self.ai_backend.current_model:
            self.ai_backend.set_model(model)
        
        # Send start marker
        await self._send(ws, 'stream_start', {'model': self.ai_backend.current_model})
        
        full_response = ""
        async for chunk in self.ai_backend.generate_stream(prompt, context, history):
            full_response += chunk
            await self._send(ws, 'stream_chunk', {'content': chunk})
        
        # Send complete
        await self._send(ws, 'stream_complete', {'content': full_response})
    
    async def _handle_get_models(self, ws):
        models = self.ai_backend.get_models()
        await self._send(ws, 'models_list', {
            'models': [asdict(m) for m in models],
            'current': self.ai_backend.current_model
        })
    
    async def _handle_switch_model(self, ws, payload: dict):
        model_id = payload.get('model', '')
        success = self.ai_backend.set_model(model_id)
        await self._send(ws, 'model_switched', {
            'success': success,
            'model': self.ai_backend.current_model
        })
    
    async def _send(self, ws, msg_type: str, payload: dict):
        try:
            await ws.send(json.dumps({'type': msg_type, 'payload': payload}))
        except Exception as e:
            logger.error(f"Send error: {e}")


async def main():
    """Main entry point"""
    logger.info("Starting Parasitic AI Python Backend")
    
    # Initialize AI backend
    ai_backend = AIBackend()
    handler = WebSocketHandler(ai_backend)
    
    # Start WebSocket server
    port = 8765
    logger.info(f"Starting WebSocket server on port {port}")
    
    async with websockets.serve(handler.handle_client, "localhost", port):
        logger.info("Backend ready. Waiting for connections...")
        await asyncio.Future()  # Run forever


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)