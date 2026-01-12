# Epic 4: AI Engine

**Goal:** implement a RAG-enabled LLM Proxy with conversation memory, streaming, and tool execution capabilities.

## 1. Backend & API (`/ai/*`)

* **Provider Proxy:** Implement handlers to connect with OpenAI and Anthropic APIs.
* **Context Manager:** Middleware to construct prompt context by fetching conversation history (`messages` from a `thread`) and relevant repository data (`projects`).
* **Tool Execution:** Enable the AI to trigger `functions` (from Epic 3) via the provider's tool-calling API.
* **Stream Handler:** Implement Server-Sent Events (SSE) to support real-time text generation for chat completions (`POST /chat`).

## 2. Database Updates

* **Optimization:** Ensure `threads` and `messages` tables are optimized for rapid retrieval (e.g., indexes on `thread_id`).

## 3. Frontend / UI

* **Chat Interface:** Build a streaming chat interface with Markdown support within `repos/admin`.
* **Prompt Playground:** Create a UI to test AI prompts with different Model configurations and context settings.


## Deliverables / Acceptance Criteria

* A fully functional, streaming chat interface that can discuss project context and execute backend tools.

---


## Context Manager - expanded

To build a robust RAG-enabled chat, you cannot simply concatenate everything. You need a **Token Budgeting Strategy** that prioritizes the "fresh" data (retrieved project context) while maintaining enough conversational history for the user to feel heard.

### 1. The Priority Hierarchy

The Context Manager should assemble the prompt payload in this strict order of importance:

1. **System Prompt (Immutable):** The core persona, constraints, and tool definitions. This must never be truncated.
2. **The User's Current Query:** Obviously required.
3. **Retrieved Project Context (RAG):** The specific code snippets, documentation, or file contents fetched based on the current query. This is the "knowledge" the AI needs to answer.
4. **Recent Conversation History:** The immediate back-and-forth.
5. **Older Conversation History:** The first victim of truncation.

### 2. Token Budgeting Algorithm

Assuming a generic context window (e.g., 128k tokens for GPT-4o or 200k for Claude 3.5 Sonnet), you should still set a **"Safety Limit"** (e.g., leaving 4k–8k tokens free for the response generation).

**The Logic Flow:**

1. **Calculate Cap:** `MaxInputTokens = ModelLimit - SafetyBuffer`
2. **Reserve Essentials:**
* `CurrentUsage = count_tokens(SystemPrompt + CurrentQuery)`
* `RemainingBudget = MaxInputTokens - CurrentUsage`


3. **Inject RAG Context:**
* Fetch relevant project chunks (vector search or active file selection).
* **Hard Limit:** Dedicate a specific slice (e.g., 40% of the budget) to this context.
* If `RAG_Data > 40%`, summarize or truncate the lowest-relevance chunks.
* *Update `RemainingBudget`.*


4. **Backfill History (Sliding Window):**
* Iterate through past messages in **reverse chronological order** (newest to oldest).
* Add message if `count_tokens(message) < RemainingBudget`.
* Stop when the budget is full.
* *Crucial:* Ensure you always include pairs (User + Assistant) to maintain flow, if possible.


### 3. Edge Case Handling

* **"Needle in a Haystack" Protection:** If the user selects *too many* files manually (explicit context), this overrides implicit history. The Context Manager should warn the frontend if the manual selection exceeds the model's limit.
* **Summarization Layer:** If the conversation history is long but contains vital context (e.g., "Remember I told you to use PyTorch?"), you can run a background task to summarize the `Older History` into a single "Memory" block that gets injected just after the System Prompt.

