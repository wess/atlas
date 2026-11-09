# {{name}}

AI-powered application with chatbot, document RAG, agent tools, and streaming responses.

Screens live at `/app/signin`, `/app/chat`, `/app/rag`, `/app/agent`, and `/app/documents`.

## Features

- **Chat** with streaming responses via SSE
- **Document RAG** upload documents, embed them, ask questions with context
- **Agent** with tool calling (weather, calculator, database query)
- **Semantic search** across indexed documents
- **Multi-provider** support for OpenAI, Anthropic, and Ollama

## Setup

```bash
bun install
test -f .env || cp .env.example .env
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

## Accounts

Every `/api` route except `/health` and sign-in needs `Authorization: Bearer <token>`. Each call
reaches a paid model, and conversations belong to the account that started them. Documents are a
knowledge base shared by every account on the instance.

Sign-up is invite-only: creating an account requires `X-Setup-Token` matching `ADMIN_SETUP_SECRET`
from `.env`. The sign-in screen has a field for it. Tokens last a day.

```bash
# Create an account (needs the setup token)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: $ADMIN_SETUP_SECRET" \
  -d '{"email": "you@example.com", "password": "a long password"}'

# Sign in and keep the token for the calls below
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "a long password"}' | jq -r .token)
```

## API Endpoints

### Chat

```bash
# Send a message (streaming SSE response)
curl -N -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'

# Continue a conversation
curl -N -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more", "conversationId": 1}'

# List conversations
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/conversations

# Get conversation history
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/conversations/1
```

### Documents

```bash
# Upload and index a document
curl -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Document", "content": "Document text here..."}'

# List documents
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/documents

# Delete a document
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/documents/1
```

### Semantic Search

```bash
# Search indexed documents
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "how does routing work?", "topK": 5}'
```

### RAG (Question Answering)

```bash
# Ask a question about your documents
curl -X POST http://localhost:3000/api/rag \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "What AI providers are supported?"}'
```

### Agent

```bash
# Run the agent with tools
curl -X POST http://localhost:3000/api/agent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in San Francisco and what is 42 * 17?"}'
```

## Indexing Documents

Upload documents through the API or the web UI at http://localhost:3000. Embeddings
live in an in-memory vector store, so re-upload documents after a restart.

## Available Tools

The agent has access to these tools:

- **get_weather** returns weather data for a city (mock)
- **calculate** evaluates arithmetic (`+ - * / % ^`, parentheses) with a small parser; it never runs model output as code
- **query_database** reads rows from an allowlist of tables (just `documents` by default) over a read-only connection, with a search term and a row cap; the model never writes SQL, and `users` and `conversations` are off the list

Add custom tools in `src/tools/` and register them in `src/tools/index.ts`. Tool arguments are model output, which a prompt-injected document can steer: validate them like request input and never `eval` them.

`atlas init` creates `.env` with fresh authentication secrets. Preserve that file. When copying this template manually, fill each authentication/setup secret with at least 32 random characters before starting.
