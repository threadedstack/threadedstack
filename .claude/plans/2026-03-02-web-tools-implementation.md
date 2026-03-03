# webSearch + webFetch Agent Tools — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the webSearch stub with real Jina AI-powered web search and add a new webFetch tool for URL content extraction, using a configurable provider pattern.

**Architecture:** Tools delegate to an `IWebProvider` interface. A factory function (`createWebProvider`) instantiates the provider (defaults to `JinaWebProvider`). Config flows from `agent.environment.webProvider` through `AgentRunner.init()` into `createSandboxTools()`. Zero new npm dependencies — uses native `fetch`.

**Tech Stack:** TypeScript, Jina AI Search/Reader APIs, pi-mono AgentTool interface, TypeBox schemas

**Design doc:** `docs/plans/2026-03-02-web-tools-design.md`

**CRITICAL GIT RULE:** NEVER commit, amend, revert, or change git history. Read-only git operations ONLY. User handles all commits.

---

## Task 1: Add Domain Types (EWebProviderBrand, TWebProviderConfig, EAgentTool.webFetch)

**Files:**
- Modify: `repos/domain/src/types/ai.types.ts`

**Step 1: Add EWebProviderBrand enum and TWebProviderConfig type**

After the `TLLMProviderBrand` type alias (line 128), add:

```typescript
/**
 * Supported web search/fetch providers.
 */
export enum EWebProviderBrand {
  jina = `jina`,
}

export type TWebProviderBrand = `${EWebProviderBrand}`

export type TWebProviderConfig = {
  type?: TWebProviderBrand
  apiKey?: string
}
```

**Step 2: Add webProvider to TAgentEnvironment**

In the `TAgentEnvironment` type (currently lines 28-51), add after the `options` field:

```typescript
  /** Web search/fetch provider configuration */
  webProvider?: TWebProviderConfig
```

**Step 3: Add webFetch to EAgentTool enum**

In the `EAgentTool` enum (currently lines 56-65), add between `webSearch` and `writeFile`:

```typescript
  webFetch = `webFetch`,
```

**Step 4: Run type checks**

Run: `cd repos/domain && pnpm types`
Expected: PASS — no compile errors

---

## Task 2: Create IWebProvider Interface and Types

**Files:**
- Create: `repos/agent/src/tools/services/web.types.ts`

**Step 1: Create the types file**

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

**Step 2: Verify types compile**

Run: `cd repos/agent && pnpm types`
Expected: PASS

---

## Task 3: Implement JinaWebProvider

**Files:**
- Create: `repos/agent/src/tools/services/jinaWebProvider.ts`
- Create: `repos/agent/src/tools/services/jinaWebProvider.test.ts`

**Step 1: Write failing tests**

Create `repos/agent/src/tools/services/jinaWebProvider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JinaWebProvider } from './jinaWebProvider'

describe(`JinaWebProvider`, () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe(`search`, () => {
    it(`should call Jina search API and return parsed results`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                title: `Vitest Docs`,
                url: `https://vitest.dev`,
                description: `Next generation testing framework`,
                content: `Full content here`,
              },
              {
                title: `Vitest GitHub`,
                url: `https://github.com/vitest-dev/vitest`,
                description: `GitHub repo`,
                content: `Repo content`,
              },
            ],
          }),
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`vitest`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `https://s.jina.ai/?q=vitest`,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: `application/json` }),
        })
      )
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        title: `Vitest Docs`,
        url: `https://vitest.dev`,
        snippet: `Next generation testing framework`,
      })
    })

    it(`should limit results to maxResults`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { title: `A`, url: `https://a.com`, description: `a`, content: `` },
              { title: `B`, url: `https://b.com`, description: `b`, content: `` },
              { title: `C`, url: `https://c.com`, description: `c`, content: `` },
            ],
          }),
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`, 2)
      expect(results).toHaveLength(2)
    })

    it(`should include Authorization header when apiKey is provided`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const provider = new JinaWebProvider({ apiKey: `jina_test_key` })
      await provider.search(`test`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer jina_test_key`,
          }),
        })
      )
    })

    it(`should return empty array on non-ok response`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: `Too Many Requests`,
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`)
      expect(results).toEqual([])
    })

    it(`should return empty array on network error`, async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error(`Network error`))

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`)
      expect(results).toEqual([])
    })
  })

  describe(`fetch`, () => {
    it(`should call Jina reader API and return parsed content`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              title: `Example Page`,
              url: `https://example.com`,
              content: `Page content in markdown`,
            },
          }),
      })

      const provider = new JinaWebProvider()
      const result = await provider.fetch(`https://example.com`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `https://r.jina.ai/https://example.com`,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: `application/json` }),
        })
      )
      expect(result).toEqual({
        url: `https://example.com`,
        title: `Example Page`,
        content: `Page content in markdown`,
        contentLength: 24,
      })
    })

    it(`should truncate content to maxLength`, async () => {
      const longContent = `x`.repeat(100)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              title: `Long Page`,
              url: `https://example.com`,
              content: longContent,
            },
          }),
      })

      const provider = new JinaWebProvider()
      const result = await provider.fetch(`https://example.com`, { maxLength: 50 })

      expect(result.content).toBe(`x`.repeat(50) + `\n\n[Content truncated at 50 characters]`)
      expect(result.contentLength).toBe(100)
    })

    it(`should throw on non-ok response`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: `Not Found`,
      })

      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com/missing`)).rejects.toThrow(
        `Fetch failed: 404 Not Found`
      )
    })

    it(`should throw on network error`, async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error(`Connection refused`))

      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com`)).rejects.toThrow(
        `Connection refused`
      )
    })

    it(`should include Authorization header when apiKey is provided`, async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { title: `Page`, url: `https://example.com`, content: `text` },
          }),
      })

      const provider = new JinaWebProvider({ apiKey: `jina_key_123` })
      await provider.fetch(`https://example.com`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer jina_key_123`,
          }),
        })
      )
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd repos/agent && pnpm test -- --reporter=verbose src/tools/services/jinaWebProvider.test.ts`
Expected: FAIL — `Cannot find module './jinaWebProvider'`

**Step 3: Implement JinaWebProvider**

Create `repos/agent/src/tools/services/jinaWebProvider.ts`:

```typescript
import type { IWebProvider, TSearchResult, TFetchResult } from './web.types'

type TJinaSearchItem = {
  title: string
  url: string
  description: string
  content: string
}

type TJinaSearchResponse = {
  data: TJinaSearchItem[]
}

type TJinaReaderResponse = {
  data: {
    title: string
    url: string
    content: string
  }
}

type TJinaProviderOpts = {
  apiKey?: string
}

const SEARCH_BASE = `https://s.jina.ai/`
const READER_BASE = `https://r.jina.ai/`

export class JinaWebProvider implements IWebProvider {
  #apiKey?: string

  constructor(opts?: TJinaProviderOpts) {
    this.#apiKey = opts?.apiKey
  }

  async search(query: string, maxResults = 5): Promise<TSearchResult[]> {
    const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    try {
      const res = await fetch(url, { headers })
      if (!res.ok) return []

      const json = (await res.json()) as TJinaSearchResponse
      return (json.data || []).slice(0, maxResults).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
      }))
    } catch {
      return []
    }
  }

  async fetch(url: string, opts?: { maxLength?: number }): Promise<TFetchResult> {
    const readerUrl = `${READER_BASE}${url}`
    const headers: Record<string, string> = { Accept: `application/json` }
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`

    const res = await fetch(readerUrl, { headers })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)

    const json = (await res.json()) as TJinaReaderResponse
    const data = json.data
    const fullLength = data.content.length
    const maxLength = opts?.maxLength ?? 50000

    let content = data.content
    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`
    }

    return {
      url: data.url,
      title: data.title,
      content,
      contentLength: fullLength,
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd repos/agent && pnpm test -- --reporter=verbose src/tools/services/jinaWebProvider.test.ts`
Expected: PASS — all 8 tests pass

---

## Task 4: Create Web Provider Factory

**Files:**
- Create: `repos/agent/src/tools/services/webProviderFactory.ts`
- Create: `repos/agent/src/tools/services/webProviderFactory.test.ts`

**Step 1: Write failing tests**

Create `repos/agent/src/tools/services/webProviderFactory.test.ts`:

```typescript
import type { TWebProviderConfig } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'
import { createWebProvider } from './webProviderFactory'
import { JinaWebProvider } from './jinaWebProvider'

describe(`createWebProvider`, () => {
  it(`should return JinaWebProvider when no config is provided`, () => {
    const provider = createWebProvider()
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when config type is jina`, () => {
    const config: TWebProviderConfig = { type: `jina` }
    const provider = createWebProvider(config)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should return JinaWebProvider when config type is undefined`, () => {
    const config: TWebProviderConfig = { apiKey: `some-key` }
    const provider = createWebProvider(config)
    expect(provider).toBeInstanceOf(JinaWebProvider)
  })

  it(`should throw for unknown provider type`, () => {
    const config = { type: `unknown-provider` } as TWebProviderConfig
    expect(() => createWebProvider(config)).toThrow(`Unknown web provider: unknown-provider`)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd repos/agent && pnpm test -- --reporter=verbose src/tools/services/webProviderFactory.test.ts`
Expected: FAIL — `Cannot find module './webProviderFactory'`

**Step 3: Implement factory**

Create `repos/agent/src/tools/services/webProviderFactory.ts`:

```typescript
import type { TWebProviderConfig } from '@tdsk/domain'
import type { IWebProvider } from './web.types'

import { JinaWebProvider } from './jinaWebProvider'

export const createWebProvider = (config?: TWebProviderConfig): IWebProvider => {
  const type = config?.type ?? `jina`

  switch (type) {
    case `jina`:
      return new JinaWebProvider({ apiKey: config?.apiKey })
    default:
      throw new Error(`Unknown web provider: ${type}`)
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd repos/agent && pnpm test -- --reporter=verbose src/tools/services/webProviderFactory.test.ts`
Expected: PASS — all 4 tests pass

---

## Task 5: Update Tool Definitions (web.ts)

**Files:**
- Modify: `repos/agent/src/tools/definitions/web/web.ts`

**Step 1: Update webSearch definition and add webFetch**

Replace the entire content of `repos/agent/src/tools/definitions/web/web.ts`:

```typescript
import type { TLLMToolDef } from '@tdsk/domain'

export const webTools: TLLMToolDef[] = [
  {
    name: `webSearch`,
    description: `Search the web for information. Returns search results with titles, URLs, and snippets.`,
    inputSchema: {
      type: `object`,
      properties: {
        query: { type: `string`, description: `Search query` },
        maxResults: { type: `number`, description: `Max results to return (default 5, max 10)` },
      },
      required: [`query`],
    },
  },
  {
    name: `webFetch`,
    description: `Fetch and extract content from a specific URL. Returns the page content as cleaned markdown text.`,
    inputSchema: {
      type: `object`,
      properties: {
        url: { type: `string`, description: `The URL to fetch` },
        maxLength: { type: `number`, description: `Max content length in chars (default: 50000)` },
      },
      required: [`url`],
    },
  },
]
```

**Step 2: Run definitions test**

Run: `cd repos/agent && pnpm test -- --reporter=verbose src/tools/definitions.test.ts`
Expected: PASS (or update if count assertions exist)

---

## Task 6: Update createSandboxTools (tools.ts)

**Files:**
- Modify: `repos/agent/src/tools/tools.ts`

This is the core change. `createSandboxTools` gains an optional `webProvider` parameter. The `webSearch` stub is replaced with a real implementation. A new `webFetch` tool is added.

**Step 1: Update function signature and imports**

At the top of `repos/agent/src/tools/tools.ts`, add the import:

```typescript
import type { IWebProvider } from './services/web.types'
```

Change the `createSandboxTools` signature (line 11-14) from:

```typescript
export const createSandboxTools = (
  sandbox: ISandbox,
  allowedTools?: string[]
): AgentTool<any>[] => {
```

to:

```typescript
export const createSandboxTools = (
  sandbox: ISandbox,
  allowedTools?: string[],
  webProvider?: IWebProvider
): AgentTool<any>[] => {
```

**Step 2: Replace the webSearch stub (lines 289-300)**

Replace the webSearch tool entry (lines 289-300):

```typescript
    {
      name: `webSearch`,
      label: `Web Search`,
      description: `Search the web for information`,
      parameters: Type.Object({
        query: Type.String({ description: `The search query` }),
      }),
      execute: async () => ({
        content: [{ type: `text` as const, text: `Web search not yet implemented` }],
        details: { success: false },
      }),
    },
```

with:

```typescript
    {
      name: `webSearch`,
      label: `Web Search`,
      description: `Search the web for information. Returns search results with titles, URLs, and snippets.`,
      parameters: Type.Object({
        query: Type.String({ description: `The search query` }),
        maxResults: Type.Optional(
          Type.Number({ description: `Max results to return (default 5, max 10)` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { query: string; maxResults?: number },
        _signal,
        onUpdate
      ) => {
        if (!webProvider) {
          return {
            content: [{ type: `text` as const, text: `Web search not configured` }],
            details: { success: false },
          }
        }
        onUpdate?.({
          content: [{ type: `text`, text: `Searching: ${params.query}` }],
          details: { status: `running` },
        })
        const maxResults = Math.min(params.maxResults || 5, 10)
        const results = await webProvider.search(params.query, maxResults)
        const text = results.length > 0
          ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join(`\n\n`)
          : `No results found`
        return {
          content: [{ type: `text` as const, text }],
          details: { success: results.length > 0, resultCount: results.length, query: params.query },
        }
      },
    },
    {
      name: `webFetch`,
      label: `Web Fetch`,
      description: `Fetch and extract content from a specific URL. Returns the page content as cleaned markdown text.`,
      parameters: Type.Object({
        url: Type.String({ description: `The URL to fetch` }),
        maxLength: Type.Optional(
          Type.Number({ description: `Max content length in chars (default: 50000)` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { url: string; maxLength?: number },
        _signal,
        onUpdate
      ) => {
        if (!webProvider) {
          return {
            content: [{ type: `text` as const, text: `Web fetch not configured` }],
            details: { success: false },
          }
        }
        onUpdate?.({
          content: [{ type: `text`, text: `Fetching: ${params.url}` }],
          details: { status: `running` },
        })
        try {
          const result = await webProvider.fetch(params.url, {
            maxLength: params.maxLength,
          })
          return {
            content: [{ type: `text` as const, text: result.content }],
            details: {
              success: true,
              url: result.url,
              title: result.title,
              contentLength: result.contentLength,
            },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown fetch error`
          return {
            content: [{ type: `text` as const, text: `Fetch failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
```

**Step 3: Verify the file compiles**

Run: `cd repos/agent && pnpm types`
Expected: PASS

---

## Task 7: Wire webProvider Through AgentRunner

**Files:**
- Modify: `repos/agent/src/runner/runner.ts`

**Step 1: Add import for factory**

Add to the imports in `repos/agent/src/runner/runner.ts`:

```typescript
import { createWebProvider } from '@TAG/tools/services/webProviderFactory'
```

**Step 2: Create webProvider in init() and pass to createSandboxTools**

In the `init()` method, after the sandbox creation block (after line 97), before `const agentTools`:

Replace line 98:
```typescript
    const agentTools = this.#sandbox ? createSandboxTools(this.#sandbox, opts.tools) : []
```

with:
```typescript
    const webProvider = opts.environment?.webProvider
      ? createWebProvider(opts.environment.webProvider)
      : createWebProvider()
    const agentTools = this.#sandbox
      ? createSandboxTools(this.#sandbox, opts.tools, webProvider)
      : []
```

**Step 3: Update runTurn() skill merge call (line 227)**

Replace line 227:
```typescript
        const mergedTools = createSandboxTools(this.#sandbox, mergedToolNames)
```

with:
```typescript
        const webProvider = initOpts.environment?.webProvider
          ? createWebProvider(initOpts.environment.webProvider)
          : createWebProvider()
        const mergedTools = createSandboxTools(this.#sandbox, mergedToolNames, webProvider)
```

**Step 4: Update updateConfig() call (line 428)**

Replace line 428:
```typescript
      const newTools = createSandboxTools(this.#sandbox, config.tools)
```

with:
```typescript
      const webProvider = this.#opts?.environment?.webProvider
        ? createWebProvider(this.#opts.environment.webProvider)
        : createWebProvider()
      const newTools = createSandboxTools(this.#sandbox, config.tools, webProvider)
```

**Step 5: Verify types compile**

Run: `cd repos/agent && pnpm types`
Expected: PASS

---

## Task 8: Update Tests

**Files:**
- Modify: `repos/agent/src/tools/tools.test.ts`

**Step 1: Update ALL_TOOL_NAMES and count assertions**

In `repos/agent/src/tools/tools.test.ts`:

Update the `ALL_TOOL_NAMES` array (line 7-18) to include `webFetch`:
```typescript
const ALL_TOOL_NAMES = [
  `shellExec`,
  `readFile`,
  `writeFile`,
  `listDir`,
  `deleteFile`,
  `mkdir`,
  `fileExists`,
  `evalCode`,
  `createArtifact`,
  `webSearch`,
  `webFetch`,
]
```

Update all `toHaveLength(10)` to `toHaveLength(11)` (lines 48, 60).

Update the labels test (line 624) to include `Web Fetch` after `Web Search`:
```typescript
    expect(labels).toEqual([
      `Shell`,
      `Read File`,
      `Write File`,
      `List Directory`,
      `Delete File`,
      `Create Directory`,
      `File Exists`,
      `Evaluate Code`,
      `Create Artifact`,
      `Web Search`,
      `Web Fetch`,
    ])
```

**Step 2: Replace webSearch stub test with real tests**

Replace the `webSearch` describe block (lines 602-618) with:

```typescript
  describe(`webSearch`, () => {
    it(`should return "not configured" when no webProvider is given`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `vitest docs` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Web search not configured` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call webProvider.search and format results`, async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue([
          { title: `Result 1`, url: `https://r1.com`, snippet: `First result` },
          { title: `Result 2`, url: `https://r2.com`, snippet: `Second result` },
        ]),
        fetch: vi.fn(),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `test query` },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.search).toHaveBeenCalledWith(`test query`, 5)
      expect(result.content[0].text).toContain(`Result 1`)
      expect(result.content[0].text).toContain(`https://r1.com`)
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, resultCount: 2 })
      )
    })

    it(`should cap maxResults at 10`, async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      await tool.execute(
        `call-1`,
        { query: `test`, maxResults: 20 },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.search).toHaveBeenCalledWith(`test`, 10)
    })

    it(`should return "No results found" when search returns empty`, async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      const result = await tool.execute(
        `call-1`,
        { query: `obscure query` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([{ type: `text`, text: `No results found` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: false, resultCount: 0 })
      )
    })

    it(`should call onUpdate with searching status`, async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn(),
      }
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webSearch`)!
      await tool.execute(`call-1`, { query: `hello` }, undefined as any, onUpdate)

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Searching: hello` }],
        details: { status: `running` },
      })
    })
  })

  describe(`webFetch`, () => {
    it(`should return "not configured" when no webProvider is given`, async () => {
      const tools = createSandboxTools(mockSandbox as any)
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Web fetch not configured` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call webProvider.fetch and return content`, async () => {
      const mockProvider = {
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `Page content here`,
          contentLength: 17,
        }),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.fetch).toHaveBeenCalledWith(`https://example.com`, {
        maxLength: undefined,
      })
      expect(result.content).toEqual([{ type: `text`, text: `Page content here` }])
      expect(result.details).toEqual(
        expect.objectContaining({ success: true, title: `Example`, contentLength: 17 })
      )
    })

    it(`should pass maxLength to provider`, async () => {
      const mockProvider = {
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `Short`,
          contentLength: 5,
        }),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      await tool.execute(
        `call-1`,
        { url: `https://example.com`, maxLength: 1000 },
        undefined as any,
        vi.fn()
      )

      expect(mockProvider.fetch).toHaveBeenCalledWith(`https://example.com`, {
        maxLength: 1000,
      })
    })

    it(`should return error message when fetch fails`, async () => {
      const mockProvider = {
        search: vi.fn(),
        fetch: vi.fn().mockRejectedValue(new Error(`404 Not Found`)),
      }
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      const result = await tool.execute(
        `call-1`,
        { url: `https://example.com/missing` },
        undefined as any,
        vi.fn()
      )

      expect(result.content).toEqual([
        { type: `text`, text: `Fetch failed: 404 Not Found` },
      ])
      expect(result.details).toEqual({ success: false })
    })

    it(`should call onUpdate with fetching status`, async () => {
      const mockProvider = {
        search: vi.fn(),
        fetch: vi.fn().mockResolvedValue({
          url: `https://example.com`,
          title: `Example`,
          content: `text`,
          contentLength: 4,
        }),
      }
      const onUpdate = vi.fn()
      const tools = createSandboxTools(mockSandbox as any, undefined, mockProvider)
      const tool = tools.find((t) => t.name === `webFetch`)!
      await tool.execute(
        `call-1`,
        { url: `https://example.com` },
        undefined as any,
        onUpdate
      )

      expect(onUpdate).toHaveBeenCalledWith({
        content: [{ type: `text`, text: `Fetching: https://example.com` }],
        details: { status: `running` },
      })
    })
  })
```

**Step 3: Run all tests**

Run: `cd repos/agent && pnpm test -- --reporter=verbose`
Expected: ALL PASS

---

## Task 9: Final Verification

**Step 1: Run all agent unit tests**

Run: `cd repos/agent && pnpm test`
Expected: ALL PASS

**Step 2: Run domain type checks**

Run: `cd repos/domain && pnpm types`
Expected: PASS

**Step 3: Run agent type checks**

Run: `cd repos/agent && pnpm types`
Expected: PASS

**Step 4: Run cross-repo type checks**

Run: `pnpm types`
Expected: PASS (all repos compile)

**Step 5: Run integration tests (if K8s is running)**

Run: `cd repos/integration && pnpm test`
Expected: PASS (existing tests unaffected; web tools only active when agents use them)

---

## Summary of All Files

| # | File | Action |
|---|------|--------|
| 1 | `repos/domain/src/types/ai.types.ts` | Modify — add EWebProviderBrand, TWebProviderConfig, TAgentEnvironment.webProvider, EAgentTool.webFetch |
| 2 | `repos/agent/src/tools/services/web.types.ts` | Create — IWebProvider, TSearchResult, TFetchResult |
| 3 | `repos/agent/src/tools/services/jinaWebProvider.ts` | Create — JinaWebProvider class |
| 4 | `repos/agent/src/tools/services/jinaWebProvider.test.ts` | Create — JinaWebProvider tests |
| 5 | `repos/agent/src/tools/services/webProviderFactory.ts` | Create — createWebProvider factory |
| 6 | `repos/agent/src/tools/services/webProviderFactory.test.ts` | Create — factory tests |
| 7 | `repos/agent/src/tools/definitions/web/web.ts` | Modify — add webFetch definition, update webSearch |
| 8 | `repos/agent/src/tools/tools.ts` | Modify — replace stub, add webFetch, accept IWebProvider param |
| 9 | `repos/agent/src/runner/runner.ts` | Modify — wire createWebProvider into init/runTurn/updateConfig |
| 10 | `repos/agent/src/tools/tools.test.ts` | Modify — update counts, add real webSearch/webFetch tests |
