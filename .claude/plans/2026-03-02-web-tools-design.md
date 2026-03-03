# Design: webSearch + webFetch Agent Tools

## Problem

The `webSearch` tool in `repos/agent` is a stub returning "not yet implemented." Agents need real web search and URL fetching capabilities to answer questions about current events, look up documentation, and retrieve web content.

## Decision: Jina AI APIs with Configurable Provider Pattern

### Why Jina AI

- **Zero new npm dependencies** — uses native `fetch` (Node 24)
- **Two endpoints cover both tools**: `s.jina.ai` (search) and `r.jina.ai` (reader)
- **Returns structured JSON** with `Accept: application/json` header
- **Free tier available** (rate-limited), optional API key for higher limits

### Why Configurable

- `IWebProvider` interface allows swapping providers without touching tool code
- Factory function (`createWebProvider`) defaults to Jina — extensible later
- Config stored on agent model at `agent.environment.webProvider`
- Follows same pattern as `ELLMProviderBrand` / `TLLMProviderBrand`

## Architecture

```
Agent model (DB)
  agent.environment.webProvider: { type: 'jina', apiKey?: '...' }
    → AgentRunner.init() reads opts.environment.webProvider
      → createWebProvider(config)         // factory, defaults to JinaWebProvider
        → IWebProvider instance
          → passed to createSandboxTools(sandbox, allowedTools, webProvider)
            → webSearch tool calls provider.search(query, maxResults)
            → webFetch tool calls provider.fetch(url, options)
```

## Types

### Domain (`repos/domain/src/types/ai.types.ts`)

```typescript
export enum EWebProviderBrand {
  jina = 'jina',
}
export type TWebProviderBrand = `${EWebProviderBrand}`

export type TWebProviderConfig = {
  type?: TWebProviderBrand
  apiKey?: string
}

// Added to TAgentEnvironment:
webProvider?: TWebProviderConfig

// Added to EAgentTool:
webFetch = 'webFetch'
```

### Agent (`repos/agent/src/tools/services/web.types.ts`)

```typescript
export type TSearchResult = {
  title: string
  url: string
  snippet: string
}

export type TFetchResult = {
  url: string
  title: string
  content: string
  contentLength: number
}

export interface IWebProvider {
  search(query: string, maxResults?: number): Promise<TSearchResult[]>
  fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult>
}
```

## Jina API Details

**Search** (`s.jina.ai`):
- URL: `https://s.jina.ai/?q=<encoded-query>`
- Headers: `Accept: application/json`, optional `Authorization: Bearer <key>`
- Response shape: `{ data: [{ title, url, description, content }] }`

**Reader** (`r.jina.ai`):
- URL: `https://r.jina.ai/<url>`
- Headers: `Accept: application/json`, optional `Authorization: Bearer <key>`
- Response shape: `{ data: { title, url, content } }`

## Files

| File | Action | Purpose |
|------|--------|---------|
| `repos/domain/src/types/ai.types.ts` | Modify | Add EWebProviderBrand, TWebProviderConfig, update TAgentEnvironment, EAgentTool |
| `repos/agent/src/tools/services/web.types.ts` | Create | IWebProvider interface, TSearchResult, TFetchResult |
| `repos/agent/src/tools/services/jinaWebProvider.ts` | Create | JinaWebProvider class implementing IWebProvider |
| `repos/agent/src/tools/services/webProviderFactory.ts` | Create | createWebProvider(config?) factory function |
| `repos/agent/src/tools/tools.ts` | Modify | Replace webSearch stub, add webFetch, accept IWebProvider param |
| `repos/agent/src/tools/definitions/web/web.ts` | Modify | Update webSearch def, add webFetch def |
| `repos/agent/src/runner/runner.ts` | Modify | Wire webProvider through init flow |
| `repos/agent/src/tools/tools.test.ts` | Modify | Update tests for real implementations |

## Verification

1. Unit tests: `cd repos/agent && pnpm test`
2. Type checks: `pnpm types` (root, cross-repo)
3. Integration tests against live K8s
