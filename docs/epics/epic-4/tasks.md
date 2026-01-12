# Epic 4: AI Engine - Task Tracking

**Goal:** Implement a RAG-enabled LLM Proxy with conversation memory, streaming, and tool execution capabilities.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## 1. Backend & API (`/ai/*`)

### 1.1 Provider Proxy Setup
- [ ] **TASK-1.1.1**: Create AI engine module at `repos/backend/src/ai/`
- [ ] **TASK-1.1.2**: Create AI router at `repos/backend/src/middleware/aiEngine.ts`
- [ ] **TASK-1.1.3**: Implement OpenAI API client wrapper
- [ ] **TASK-1.1.4**: Implement Anthropic API client wrapper
- [ ] **TASK-1.1.5**: Create provider abstraction interface for multi-provider support
- [ ] **TASK-1.1.6**: Implement provider selection based on request/config
- [ ] **TASK-1.1.7**: Implement API key injection from secrets

### 1.2 Providers API
- [ ] **TASK-1.2.1**: Create providers endpoint at `repos/backend/src/endpoints/providers.ts`
- [ ] **TASK-1.2.2**: Implement `POST /_/providers` - Create provider config
- [ ] **TASK-1.2.3**: Implement `GET /_/providers` - List providers
- [ ] **TASK-1.2.4**: Implement `GET /_/providers/:id` - Get provider by ID
- [ ] **TASK-1.2.5**: Implement `PUT /_/providers/:id` - Update provider
- [ ] **TASK-1.2.6**: Implement `DELETE /_/providers/:id` - Delete provider
- [ ] **TASK-1.2.7**: Store provider API keys as secrets (encrypted)

### 1.3 Threads & Messages API
- [ ] **TASK-1.3.1**: Create threads endpoint at `repos/backend/src/endpoints/threads.ts`
- [ ] **TASK-1.3.2**: Implement `POST /_/threads` - Create thread
- [ ] **TASK-1.3.3**: Implement `GET /_/threads` - List threads
- [ ] **TASK-1.3.4**: Implement `GET /_/threads/:id` - Get thread with messages
- [ ] **TASK-1.3.5**: Implement `DELETE /_/threads/:id` - Delete thread
- [ ] **TASK-1.3.6**: Implement `POST /_/threads/:id/messages` - Add message to thread
- [ ] **TASK-1.3.7**: Implement `GET /_/threads/:id/messages` - Get thread messages (paginated)
- [ ] **TASK-1.3.8**: Implement thread title auto-generation from first message

### 1.4 Chat Completion API
- [ ] **TASK-1.4.1**: Implement `POST /ai/chat` - Chat completion endpoint
- [ ] **TASK-1.4.2**: Implement `POST /ai/chat/stream` - Streaming chat endpoint
- [ ] **TASK-1.4.3**: Parse and validate chat request body
- [ ] **TASK-1.4.4**: Load thread history for context
- [ ] **TASK-1.4.5**: Construct provider-specific request format
- [ ] **TASK-1.4.6**: Handle provider API errors gracefully
- [ ] **TASK-1.4.7**: Store assistant response as message in thread

---

## 2. Context Manager

### 2.1 Token Budgeting
- [ ] **TASK-2.1.1**: Create context manager module at `repos/backend/src/ai/context/`
- [ ] **TASK-2.1.2**: Implement token counting utility (tiktoken or similar)
- [ ] **TASK-2.1.3**: Implement model limit configuration (128k, 200k, etc.)
- [ ] **TASK-2.1.4**: Implement safety buffer configuration
- [ ] **TASK-2.1.5**: Calculate `MaxInputTokens = ModelLimit - SafetyBuffer`

### 2.2 Priority Hierarchy Assembly
- [ ] **TASK-2.2.1**: Implement system prompt loader (immutable, never truncated)
- [ ] **TASK-2.2.2**: Implement current user query injection
- [ ] **TASK-2.2.3**: Implement RAG context injection with budget allocation (40%)
- [ ] **TASK-2.2.4**: Implement conversation history backfill (sliding window)
- [ ] **TASK-2.2.5**: Ensure user+assistant message pairs are kept together

### 2.3 RAG Integration
- [ ] **TASK-2.3.1**: Research vector database options (pgvector, Pinecone)
- [ ] **TASK-2.3.2**: Implement document chunking utility
- [ ] **TASK-2.3.3**: Implement embedding generation (OpenAI embeddings API)
- [ ] **TASK-2.3.4**: Implement vector similarity search
- [ ] **TASK-2.3.5**: Implement relevance scoring for chunks
- [ ] **TASK-2.3.6**: Implement chunk summarization for over-budget scenarios
- [ ] **TASK-2.3.7**: Support explicit file/project selection by user

### 2.4 Edge Case Handling
- [ ] **TASK-2.4.1**: Implement "needle in a haystack" protection
- [ ] **TASK-2.4.2**: Warn frontend when manual selection exceeds model limit
- [ ] **TASK-2.4.3**: Implement history summarization for long conversations
- [ ] **TASK-2.4.4**: Create "Memory" block injection after system prompt

---

## 3. Tool Execution

### 3.1 Tool Definition System
- [ ] **TASK-3.1.1**: Create tool definition schema
- [ ] **TASK-3.1.2**: Implement tool definition storage in database
- [ ] **TASK-3.1.3**: Implement `POST /_/tools` - Create tool definition
- [ ] **TASK-3.1.4**: Implement `GET /_/tools` - List tools
- [ ] **TASK-3.1.5**: Link tools to functions (Epic 3 FaaS)
- [ ] **TASK-3.1.6**: Generate OpenAI function calling format from tools
- [ ] **TASK-3.1.7**: Generate Anthropic tool use format from tools

### 3.2 Tool Execution Flow
- [ ] **TASK-3.2.1**: Parse tool calls from provider response
- [ ] **TASK-3.2.2**: Validate tool call parameters
- [ ] **TASK-3.2.3**: Execute linked function (via FaaS engine)
- [ ] **TASK-3.2.4**: Format tool result for provider
- [ ] **TASK-3.2.5**: Handle tool execution errors
- [ ] **TASK-3.2.6**: Support multiple tool calls in single response
- [ ] **TASK-3.2.7**: Implement tool call confirmation (optional user approval)

---

## 4. Streaming Handler

### 4.1 Server-Sent Events (SSE)
- [ ] **TASK-4.1.1**: Implement SSE response handler
- [ ] **TASK-4.1.2**: Configure keep-alive for long connections
- [ ] **TASK-4.1.3**: Implement chunk parsing from provider streams
- [ ] **TASK-4.1.4**: Forward text chunks to client in real-time
- [ ] **TASK-4.1.5**: Handle stream completion event
- [ ] **TASK-4.1.6**: Handle stream error event
- [ ] **TASK-4.1.7**: Implement connection timeout handling

### 4.2 Stream Processing
- [ ] **TASK-4.2.1**: Accumulate streamed content for storage
- [ ] **TASK-4.2.2**: Detect tool calls in streaming response
- [ ] **TASK-4.2.3**: Handle partial JSON in tool call arguments
- [ ] **TASK-4.2.4**: Store complete response after stream ends
- [ ] **TASK-4.2.5**: Track token usage from stream metadata

---

## 5. Database Optimization

### 5.1 Threads & Messages Indexes
- [ ] **TASK-5.1.1**: Add index on `threads.user_id`
- [ ] **TASK-5.1.2**: Add index on `threads.org_id`
- [ ] **TASK-5.1.3**: Add index on `messages.thread_id`
- [ ] **TASK-5.1.4**: Add composite index on `messages(thread_id, created_at)`
- [ ] **TASK-5.1.5**: Analyze query patterns and add additional indexes

### 5.2 Vector Storage (for RAG)
- [ ] **TASK-5.2.1**: Install pgvector extension in Neon
- [ ] **TASK-5.2.2**: Create embeddings table schema
- [ ] **TASK-5.2.3**: Add vector similarity index (ivfflat or hnsw)
- [ ] **TASK-5.2.4**: Implement embedding storage API
- [ ] **TASK-5.2.5**: Implement embedding search API

---

## 6. Frontend / UI

### 6.1 Chat Interface
- [ ] **TASK-6.1.1**: Create Chat page at `repos/admin/src/pages/Chat/Chat.tsx`
- [ ] **TASK-6.1.2**: Create ChatThread component for message display
- [ ] **TASK-6.1.3**: Create ChatMessage component with Markdown support
- [ ] **TASK-6.1.4**: Implement user message input with send button
- [ ] **TASK-6.1.5**: Implement streaming text display (typewriter effect)
- [ ] **TASK-6.1.6**: Implement code block rendering with syntax highlighting
- [ ] **TASK-6.1.7**: Implement message copy functionality
- [ ] **TASK-6.1.8**: Create thread sidebar for thread navigation
- [ ] **TASK-6.1.9**: Implement new thread creation
- [ ] **TASK-6.1.10**: Implement thread deletion

### 6.2 Context Selection UI
- [ ] **TASK-6.2.1**: Create project/file context picker component
- [ ] **TASK-6.2.2**: Implement file tree browser for project context
- [ ] **TASK-6.2.3**: Display selected context with token count
- [ ] **TASK-6.2.4**: Warn when context exceeds model limit
- [ ] **TASK-6.2.5**: Implement context removal

### 6.3 Prompt Playground
- [ ] **TASK-6.3.1**: Create Playground page at `repos/admin/src/pages/Playground/Playground.tsx`
- [ ] **TASK-6.3.2**: Implement system prompt editor
- [ ] **TASK-6.3.3**: Implement model selector dropdown
- [ ] **TASK-6.3.4**: Implement temperature/parameter controls
- [ ] **TASK-6.3.5**: Implement context injection toggle
- [ ] **TASK-6.3.6**: Implement test execution with response display
- [ ] **TASK-6.3.7**: Display token usage statistics
- [ ] **TASK-6.3.8**: Implement prompt template save/load

### 6.4 Providers Configuration UI
- [ ] **TASK-6.4.1**: Create Providers page at `repos/admin/src/pages/Providers/`
- [ ] **TASK-6.4.2**: Implement provider list with status indicators
- [ ] **TASK-6.4.3**: Implement provider creation form
- [ ] **TASK-6.4.4**: Implement API key input (masked, stored as secret)
- [ ] **TASK-6.4.5**: Implement provider test connection

---

## Deliverables Checklist

- [ ] User can configure AI provider (OpenAI, Anthropic)
- [ ] User can create and manage chat threads
- [ ] User can send messages and receive streaming responses
- [ ] Chat interface renders Markdown content properly
- [ ] AI can access project context via RAG
- [ ] AI can execute backend tools/functions
- [ ] Prompt playground allows testing different configurations
- [ ] Conversation history is properly managed with token budgeting

---

## Dependencies

- **Epic 1**: Base Setup (Auth, Users, Orgs, basic UI)
- **Epic 2**: Proxy Feature (Secrets for API key storage)
- **Epic 3**: FaaS (Functions for tool execution)

## Technical Notes

- Use `tiktoken` for accurate OpenAI token counting
- Anthropic has different tokenization - may need separate counter
- pgvector is recommended for RAG since Neon already supports it
- Consider caching embeddings for frequently-accessed documents
- SSE requires proper connection handling and error recovery
- Tool execution should be async to not block streaming
- Consider implementing conversation branching for complex workflows
