# {{name}}

AI-powered application with chatbot, document RAG, agent tools, and streaming responses.

## Features

- **Chat** with streaming responses via SSE
- **Document RAG** upload documents, embed them, ask questions with context
- **Agent** with tool calling (weather, calculator, database query)
- **Semantic search** across indexed documents
- **Multi-provider** support for OpenAI, Anthropic, and Ollama

## Setup

```bash
bun install
cp .env.example .env
# Edit .env with your API key
bun run migrate:up
bun run dev
```

## Configuration

Set your AI provider in `.env`:

```bash
# OpenAI (default)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (local)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

## API Endpoints

### Chat

```bash
# Send a message (streaming SSE response)
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'

# Continue a conversation
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more", "conversationId": 1}'

# List conversations
curl http://localhost:3000/api/conversations

# Get conversation history
curl http://localhost:3000/api/conversations/1
```

### Documents

```bash
# Upload and index a document
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "My Document", "content": "Document text here..."}'

# List documents
curl http://localhost:3000/api/documents

# Delete a document
curl -X DELETE http://localhost:3000/api/documents/1
```

### Semantic Search

```bash
# Search indexed documents
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "how does routing work?", "topK": 5}'
```

### RAG (Question Answering)

```bash
# Ask a question about your documents
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -d '{"question": "What AI providers are supported?"}'
```

### Agent

```bash
# Run the agent with tools
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in San Francisco and what is 42 * 17?"}'
```

## Indexing Documents

Upload documents through the API or the web UI. You can also index the sample document:

```bash
bun run index
```

## Available Tools

The agent has access to these tools:

- **get_weather** returns weather data for a city (mock)
- **calculate** evaluates math expressions
- **query_database** runs read-only SQL queries against the database

Add custom tools in `src/tools/` and register them in `src/tools/index.ts`.
