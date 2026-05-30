# Threads Sandbox UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web UI in the Threads app that lets non-developers interact with AI tools running in Threaded Stack sandboxes via a chat interface backed by terminal parsing, with a secondary terminal tab for power users.

**Architecture:** A new WebSocket shell endpoint in the backend bridges browser connections to SSH sessions inside K8s pods via the `ssh2` library. A session broker keeps SSH alive across WebSocket reconnects. A shared terminal parser in `@tdsk/domain` converts raw PTY output into structured events — used by the backend for DB persistence and the frontend for chat rendering. The Threads SPA (Vite + React + MUI + Jotai) renders these events in a chat view alongside a ghostty-web terminal view.

**Tech Stack:** TypeScript, ssh2, ghostty-web (WASM terminal), Jotai, TanStack Query, MUI 6, React Router v7, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-threads-sandbox-ui-design.md`

**Critical rules (include in ALL subagent prompts):**
- NEVER run `git commit`, `git push`, or any git history-modifying command
- NEVER add TODO/FIXME comments — implement fully or explain why you can't
- NEVER place shared/exported types next to related files — they go in `types/` directory
- NEVER re-export from another package — update all callsites
- API calls ONLY through actions, never from components or useEffect
- Follow admin repo state pattern: Loaders → Actions → Jotai → Components (read-only)

---

## Phase 1: Terminal Parser (`@tdsk/domain`)

The parser is the foundation — both backend and frontend depend on it. Pure TypeScript, zero browser APIs. All tests must pass before moving to Phase 2.

---

### Task 1: Parser Types

**Files:**
- Create: `repos/domain/src/parser/types.ts`
- Modify: `repos/domain/src/types/index.ts` (add export)

- [ ] **Step 1: Create parser types file**

```typescript
// repos/domain/src/parser/types.ts

export type TParsedEvent =
  | { type: 'text'; content: string; timestamp: number }
  | { type: 'input'; content: string; timestamp: number }
  | { type: 'tool-call'; tool: string; target: string; status: 'running' | 'done'; detail?: string; timestamp: number }
  | { type: 'permission'; prompt: string; command?: string; timestamp: number }
  | { type: 'diff'; file: string; additions: string[]; removals: string[]; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'thinking'; timestamp: number }
  | { type: 'prompt-ready'; timestamp: number }
  | { type: 'unknown'; raw: string; timestamp: number }

export type TToolState =
  | 'idle'
  | 'prompt'
  | 'working'
  | 'permission'
  | 'interactive'

export type TSegmenterState = 'outputting' | 'waiting' | 'interactive'

export type TBlock = {
  type: 'input' | 'output'
  content: string
  timestamp: number
}

export type TPatternMatcher = {
  name: string
  match: (text: string) => TParsedEvent | null
}

export type TTerminalParserOpts = {
  runtime: string
  onEvent: (event: TParsedEvent) => void
  onToolState: (state: TToolState) => void
  debounceMs?: number
}
```

- [ ] **Step 2: Export from domain types barrel**

Add to `repos/domain/src/types/index.ts`:
```typescript
export * from '../parser/types'
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: No errors

---

### Task 2: ANSI Processor

**Files:**
- Create: `repos/domain/src/parser/ansiProcessor.ts`
- Create: `repos/domain/src/parser/ansiProcessor.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/domain/src/parser/ansiProcessor.test.ts
import { describe, it, expect } from 'vitest'
import { stripAnsi } from './ansiProcessor'

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world')
  })

  it('strips SGR color codes', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text')
  })

  it('strips bold/underline sequences', () => {
    expect(stripAnsi('\x1b[1mbold\x1b[22m \x1b[4munderline\x1b[24m')).toBe('bold underline')
  })

  it('strips cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2J\x1b[H\x1b[3Ahello')).toBe('hello')
  })

  it('strips OSC sequences', () => {
    expect(stripAnsi('\x1b]0;window title\x07some text')).toBe('some text')
  })

  it('strips 256-color and RGB sequences', () => {
    expect(stripAnsi('\x1b[38;5;196mred\x1b[0m \x1b[38;2;255;0;0mrgb\x1b[0m')).toBe('red rgb')
  })

  it('preserves newlines', () => {
    expect(stripAnsi('\x1b[32mline1\n\x1b[33mline2\n')).toBe('line1\nline2\n')
  })

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/parser/ansiProcessor.test.ts`
Expected: FAIL — `stripAnsi` not found

- [ ] **Step 3: Implement ANSI processor**

```typescript
// repos/domain/src/parser/ansiProcessor.ts

// Matches ANSI escape sequences:
// - CSI sequences: ESC [ ... (params) ... (final byte)
// - OSC sequences: ESC ] ... (ST or BEL)
// - Simple escapes: ESC + single char
// - C1 control codes (0x80-0x9F range via \u009B)
const ANSI_RE = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07]*\x07|\x1b[^[\]()#;?0-9A-ORZcf-nq-uy=><~]/g

export const stripAnsi = (str: string): string => str.replace(ANSI_RE, '')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/parser/ansiProcessor.test.ts`
Expected: All tests PASS

---

### Task 3: Block Segmenter

**Files:**
- Create: `repos/domain/src/parser/blockSegmenter.ts`
- Create: `repos/domain/src/parser/blockSegmenter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/domain/src/parser/blockSegmenter.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { BlockSegmenter } from './blockSegmenter'
import type { TBlock } from './types'

describe('BlockSegmenter', () => {
  let segmenter: BlockSegmenter
  let blocks: TBlock[]

  beforeEach(() => {
    blocks = []
    segmenter = new BlockSegmenter((block) => blocks.push(block))
  })

  it('emits output block on newline-terminated text', () => {
    segmenter.feed('Hello world\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('output')
    expect(blocks[0].content).toBe('Hello world')
  })

  it('marks text as input when it matches sent stdin', () => {
    segmenter.markSent('hello\n')
    segmenter.feed('hello\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('input')
    expect(blocks[0].content).toBe('hello')
  })

  it('separates multiple lines into blocks on prompt detection', () => {
    segmenter.feed('output line 1\noutput line 2\n> ')
    segmenter.flush()
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    const outputBlock = blocks.find(b => b.type === 'output')
    expect(outputBlock).toBeDefined()
  })

  it('detects prompt readiness from > prefix', () => {
    let state = segmenter.getState()
    expect(state).toBe('waiting')
    segmenter.feed('some output\n> ')
    state = segmenter.getState()
    expect(state).toBe('waiting')
  })

  it('transitions to outputting on non-prompt content', () => {
    segmenter.feed('⏺ Read src/index.ts\n')
    expect(segmenter.getState()).toBe('outputting')
  })

  it('buffers partial lines until newline arrives', () => {
    segmenter.feed('partial')
    expect(blocks).toHaveLength(0)
    segmenter.feed(' line\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].content).toBe('partial line')
  })

  it('handles empty input', () => {
    segmenter.feed('')
    segmenter.flush()
    expect(blocks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/parser/blockSegmenter.test.ts`
Expected: FAIL — `BlockSegmenter` not found

- [ ] **Step 3: Implement block segmenter**

```typescript
// repos/domain/src/parser/blockSegmenter.ts
import type { TBlock, TSegmenterState } from './types'

const PROMPT_RE = /^[>$#] $/

export class BlockSegmenter {
  private buffer = ''
  private state: TSegmenterState = 'waiting'
  private pendingSent: Set<string> = new Set()
  private onBlock: (block: TBlock) => void

  constructor(onBlock: (block: TBlock) => void) {
    this.onBlock = onBlock
  }

  getState(): TSegmenterState {
    return this.state
  }

  markSent(text: string) {
    this.pendingSent.add(text.trim())
  }

  feed(data: string) {
    this.buffer += data
    this.processBuffer()
  }

  flush() {
    if (this.buffer.trim()) {
      this.emitBlock(this.buffer)
      this.buffer = ''
    }
  }

  private processBuffer() {
    const lines = this.buffer.split('\n')
    // Keep the last element — it's either empty (line ended with \n) or a partial line
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      this.emitBlock(line)
    }

    // Check if remaining buffer looks like a prompt
    if (PROMPT_RE.test(this.buffer)) {
      this.state = 'waiting'
    }
  }

  private emitBlock(raw: string) {
    const content = raw.trim()
    if (!content) return

    const isInput = this.pendingSent.has(content)
    if (isInput) {
      this.pendingSent.delete(content)
    }

    if (!isInput) {
      this.state = 'outputting'
    }

    this.onBlock({
      type: isInput ? 'input' : 'output',
      content,
      timestamp: Date.now(),
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/parser/blockSegmenter.test.ts`
Expected: All tests PASS

---

### Task 4: Claude Code Pattern Matchers

**Files:**
- Create: `repos/domain/src/parser/matchers/claudeCode.ts`
- Create: `repos/domain/src/parser/matchers/claudeCode.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/domain/src/parser/matchers/claudeCode.test.ts
import { describe, it, expect } from 'vitest'
import { claudeCodeMatchers } from './claudeCode'
import type { TParsedEvent } from '../types'

const runMatchers = (text: string): TParsedEvent | null => {
  for (const matcher of claudeCodeMatchers) {
    const result = matcher.match(text)
    if (result) return result
  }
  return null
}

describe('claudeCodeMatchers', () => {
  describe('tool call detection', () => {
    it('detects Read tool call', () => {
      const result = runMatchers('⏺ Read src/index.ts')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('tool-call')
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Read')
        expect(result!.target).toBe('src/index.ts')
        expect(result!.status).toBe('running')
      }
    })

    it('detects Edit tool call', () => {
      const result = runMatchers('⏺ Edit src/App.tsx')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Edit')
        expect(result!.target).toBe('src/App.tsx')
      }
    })

    it('detects Bash tool call', () => {
      const result = runMatchers('⏺ Bash npm install express')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Bash')
        expect(result!.target).toBe('npm install express')
      }
    })

    it('detects Write tool call', () => {
      const result = runMatchers('⏺ Write src/new-file.ts')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Write')
      }
    })
  })

  describe('permission detection', () => {
    it('detects y/n permission prompt', () => {
      const result = runMatchers('Allow Edit to src/App.tsx? (y/n)')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('permission')
    })

    it('detects "Do you want to" pattern', () => {
      const result = runMatchers('Do you want to proceed? (y/n)')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('permission')
    })
  })

  describe('error detection', () => {
    it('detects Error: prefix', () => {
      const result = runMatchers('Error: Cannot find module "foo"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('error')
    })

    it('detects cross mark errors', () => {
      const result = runMatchers('✗ Build failed')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('error')
    })
  })

  describe('prompt detection', () => {
    it('detects > prompt', () => {
      const result = runMatchers('> ')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('prompt-ready')
    })

    it('detects $ shell prompt', () => {
      const result = runMatchers('$ ')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('prompt-ready')
    })
  })

  describe('diff detection', () => {
    it('detects diff additions', () => {
      const result = runMatchers('+ import { useState } from "react"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('diff')
    })

    it('detects diff removals', () => {
      const result = runMatchers('- import { Component } from "react"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('diff')
    })
  })

  it('returns null for unrecognized text', () => {
    const result = runMatchers('just some regular output text')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/parser/matchers/claudeCode.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Claude Code matchers**

```typescript
// repos/domain/src/parser/matchers/claudeCode.ts
import type { TPatternMatcher, TParsedEvent } from '../types'

// ⏺ ToolName target
const TOOL_CALL_RE = /^⏺\s+(Read|Edit|Write|Bash|Glob|Grep|Agent|TodoWrite|WebFetch|WebSearch)\s+(.+)$/

// Permission prompts
const PERMISSION_YN_RE = /(?:Allow|Do you want to)\s+(.+?)\s*\?\s*\(y\/n\)/i
const PERMISSION_PROCEED_RE = /Do you want to proceed\?\s*\(y\/n\)/i

// Error patterns
const ERROR_PREFIX_RE = /^Error:\s+(.+)/
const ERROR_CROSS_RE = /^✗\s+(.+)/

// Prompt patterns
const PROMPT_RE = /^[>$]\s*$/

// Diff patterns (only match if line starts with +/- and has content after)
const DIFF_ADD_RE = /^\+\s+(.+)/
const DIFF_REMOVE_RE = /^-\s+(.+)/

const now = () => Date.now()

export const claudeCodeMatchers: TPatternMatcher[] = [
  {
    name: 'tool-call',
    match(text: string): TParsedEvent | null {
      const m = text.match(TOOL_CALL_RE)
      if (!m) return null
      return { type: 'tool-call', tool: m[1], target: m[2], status: 'running', timestamp: now() }
    },
  },
  {
    name: 'permission',
    match(text: string): TParsedEvent | null {
      const m = text.match(PERMISSION_YN_RE) || text.match(PERMISSION_PROCEED_RE)
      if (!m) return null
      return { type: 'permission', prompt: text, command: m[1], timestamp: now() }
    },
  },
  {
    name: 'error',
    match(text: string): TParsedEvent | null {
      const m = text.match(ERROR_PREFIX_RE) || text.match(ERROR_CROSS_RE)
      if (!m) return null
      return { type: 'error', message: m[1] || text, timestamp: now() }
    },
  },
  {
    name: 'prompt-ready',
    match(text: string): TParsedEvent | null {
      if (!PROMPT_RE.test(text)) return null
      return { type: 'prompt-ready', timestamp: now() }
    },
  },
  {
    name: 'diff',
    match(text: string): TParsedEvent | null {
      const addMatch = text.match(DIFF_ADD_RE)
      if (addMatch) return { type: 'diff', file: '', additions: [addMatch[1]], removals: [], timestamp: now() }
      const removeMatch = text.match(DIFF_REMOVE_RE)
      if (removeMatch) return { type: 'diff', file: '', additions: [], removals: [removeMatch[1]], timestamp: now() }
      return null
    },
  },
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/parser/matchers/claudeCode.test.ts`
Expected: All tests PASS

---

### Task 5: Pattern Matcher Pipeline

**Files:**
- Create: `repos/domain/src/parser/patternMatcher.ts`
- Create: `repos/domain/src/parser/patternMatcher.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/domain/src/parser/patternMatcher.test.ts
import { describe, it, expect } from 'vitest'
import { PatternMatcherPipeline } from './patternMatcher'
import { claudeCodeMatchers } from './matchers/claudeCode'
import type { TBlock, TParsedEvent } from './types'

describe('PatternMatcherPipeline', () => {
  it('matches output blocks against registered matchers', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Read src/index.ts', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('tool-call')
  })

  it('emits text event for unmatched output', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: 'just regular text', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('text')
    if (events[0].type === 'text') {
      expect(events[0].content).toBe('just regular text')
    }
  })

  it('emits input events for input blocks without pattern matching', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'input', content: 'user typed this', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('input')
  })

  it('uses first matching pattern (priority order)', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Edit src/App.tsx', timestamp: 1 })
    expect(events[0].type).toBe('tool-call')
  })

  it('works with empty matchers list (all output becomes text)', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([], (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Read something', timestamp: 1 })
    expect(events[0].type).toBe('text')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/parser/patternMatcher.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pattern matcher pipeline**

```typescript
// repos/domain/src/parser/patternMatcher.ts
import type { TBlock, TPatternMatcher, TParsedEvent } from './types'

export class PatternMatcherPipeline {
  private matchers: TPatternMatcher[]
  private onEvent: (event: TParsedEvent) => void

  constructor(matchers: TPatternMatcher[], onEvent: (event: TParsedEvent) => void) {
    this.matchers = matchers
    this.onEvent = onEvent
  }

  process(block: TBlock) {
    if (block.type === 'input') {
      this.onEvent({ type: 'input', content: block.content, timestamp: block.timestamp })
      return
    }

    for (const matcher of this.matchers) {
      const event = matcher.match(block.content)
      if (event) {
        this.onEvent(event)
        return
      }
    }

    this.onEvent({ type: 'text', content: block.content, timestamp: block.timestamp })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/parser/patternMatcher.test.ts`
Expected: All tests PASS

---

### Task 6: Terminal Parser Orchestrator

**Files:**
- Create: `repos/domain/src/parser/terminalParser.ts`
- Create: `repos/domain/src/parser/terminalParser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/domain/src/parser/terminalParser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TerminalParser } from './terminalParser'
import type { TParsedEvent, TToolState } from './types'

describe('TerminalParser', () => {
  let events: TParsedEvent[]
  let toolStates: TToolState[]
  let parser: TerminalParser

  beforeEach(() => {
    events = []
    toolStates = []
    parser = new TerminalParser({
      runtime: 'claude-code',
      onEvent: (e) => events.push(e),
      onToolState: (s) => toolStates.push(s),
      debounceMs: 0, // no debounce for tests
    })
  })

  it('parses plain text output into text events', () => {
    parser.write('Hello world\n')
    parser.flush()
    expect(events.length).toBeGreaterThanOrEqual(1)
    const textEvents = events.filter(e => e.type === 'text')
    expect(textEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('strips ANSI before parsing', () => {
    parser.write('\x1b[32mGreen text\x1b[0m\n')
    parser.flush()
    const textEvent = events.find(e => e.type === 'text')
    expect(textEvent).toBeDefined()
    if (textEvent?.type === 'text') {
      expect(textEvent.content).not.toContain('\x1b')
      expect(textEvent.content).toContain('Green text')
    }
  })

  it('detects Claude Code tool calls', () => {
    parser.write('⏺ Read src/index.ts\n')
    parser.flush()
    const toolCall = events.find(e => e.type === 'tool-call')
    expect(toolCall).toBeDefined()
  })

  it('detects permission prompts and updates tool state', () => {
    parser.write('Allow Edit to src/App.tsx? (y/n)\n')
    parser.flush()
    const permission = events.find(e => e.type === 'permission')
    expect(permission).toBeDefined()
    expect(toolStates).toContain('permission')
  })

  it('marks input blocks when stdin is tracked', () => {
    parser.trackInput('hello world')
    parser.write('hello world\n')
    parser.flush()
    const inputEvent = events.find(e => e.type === 'input')
    expect(inputEvent).toBeDefined()
  })

  it('transitions to working state on output', () => {
    parser.write('⏺ Read src/index.ts\n')
    parser.flush()
    expect(toolStates).toContain('working')
  })

  it('transitions to prompt state on prompt-ready', () => {
    parser.write('> \n')
    parser.flush()
    expect(toolStates).toContain('prompt')
  })

  it('falls back to unknown for non-claude-code runtimes', () => {
    const customParser = new TerminalParser({
      runtime: 'custom',
      onEvent: (e) => events.push(e),
      onToolState: (s) => toolStates.push(s),
      debounceMs: 0,
    })
    customParser.write('⏺ Read src/index.ts\n')
    customParser.flush()
    // With no matchers, this becomes text (not tool-call)
    const textEvent = events.find(e => e.type === 'text' && e.content.includes('Read'))
    expect(textEvent).toBeDefined()
  })

  it('provides raw bytes buffer for terminal replay', () => {
    const data = '⏺ Read src/index.ts\nsome output\n'
    parser.write(data)
    const raw = parser.getRawBuffer()
    expect(raw).toContain(data)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/domain && npx vitest run src/parser/terminalParser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement terminal parser**

```typescript
// repos/domain/src/parser/terminalParser.ts
import { stripAnsi } from './ansiProcessor'
import { BlockSegmenter } from './blockSegmenter'
import { PatternMatcherPipeline } from './patternMatcher'
import { claudeCodeMatchers } from './matchers/claudeCode'
import type { TPatternMatcher, TParsedEvent, TToolState, TTerminalParserOpts } from './types'
import { ESandboxRuntime } from '@tdsk/domain/types'

const matchersByRuntime: Record<string, TPatternMatcher[]> = {
  [ESandboxRuntime.claudeCode]: claudeCodeMatchers,
}

export class TerminalParser {
  private segmenter: BlockSegmenter
  private pipeline: PatternMatcherPipeline
  private onEvent: (event: TParsedEvent) => void
  private onToolState: (state: TToolState) => void
  private rawBuffer: string[] = []
  private toolState: TToolState = 'idle'
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingData = ''
  private debounceMs: number

  constructor(opts: TTerminalParserOpts) {
    this.onEvent = opts.onEvent
    this.onToolState = opts.onToolState
    this.debounceMs = opts.debounceMs ?? 100

    const matchers = matchersByRuntime[opts.runtime] ?? []

    this.pipeline = new PatternMatcherPipeline(matchers, (event) => {
      this.onEvent(event)
      this.updateToolState(event)
    })

    this.segmenter = new BlockSegmenter((block) => {
      this.pipeline.process(block)
    })
  }

  write(data: string) {
    this.rawBuffer.push(data)

    if (this.debounceMs === 0) {
      this.processData(data)
      return
    }

    this.pendingData += data
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.processData(this.pendingData)
      this.pendingData = ''
    }, this.debounceMs)
  }

  private processData(data: string) {
    const clean = stripAnsi(data)
    this.segmenter.feed(clean)
  }

  trackInput(text: string) {
    this.segmenter.markSent(text)
  }

  flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.pendingData) {
      this.processData(this.pendingData)
      this.pendingData = ''
    }
    this.segmenter.flush()
  }

  getRawBuffer(): string {
    return this.rawBuffer.join('')
  }

  getToolState(): TToolState {
    return this.toolState
  }

  private updateToolState(event: TParsedEvent) {
    let newState: TToolState | null = null

    switch (event.type) {
      case 'tool-call':
      case 'text':
      case 'diff':
      case 'thinking':
        newState = 'working'
        break
      case 'permission':
        newState = 'permission'
        break
      case 'prompt-ready':
        newState = 'prompt'
        break
      case 'error':
        newState = 'prompt'
        break
    }

    if (newState && newState !== this.toolState) {
      this.toolState = newState
      this.onToolState(newState)
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && npx vitest run src/parser/terminalParser.test.ts`
Expected: All tests PASS

---

### Task 7: Parser Barrel Export

**Files:**
- Create: `repos/domain/src/parser/index.ts`
- Modify: `repos/domain/src/models/index.ts` or `repos/domain/src/index.ts` (add parser re-export)

- [ ] **Step 1: Create parser barrel**

```typescript
// repos/domain/src/parser/index.ts
export { stripAnsi } from './ansiProcessor'
export { BlockSegmenter } from './blockSegmenter'
export { PatternMatcherPipeline } from './patternMatcher'
export { TerminalParser } from './terminalParser'
export { claudeCodeMatchers } from './matchers/claudeCode'
export * from './types'
```

- [ ] **Step 2: Run all parser tests together**

Run: `cd repos/domain && npx vitest run src/parser/`
Expected: All tests PASS across all 4 test files

- [ ] **Step 3: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: No type errors

---

## Phase 2: Database Schema

---

### Task 8: Add sandboxId to Threads Table

**Files:**
- Modify: `repos/database/src/schemas/threads.ts`
- Modify: `repos/database/src/types/schema.types.ts` (if thread types are manually maintained)

- [ ] **Step 1: Add sandboxId column to threads schema**

In `repos/database/src/schemas/threads.ts`, add to the table definition (alongside existing FKs like `agentId`, `projectId`):

```typescript
sandboxId: varchar(`sandbox_id`, { length: 10 }).references(() => sandboxes.id, {
  onDelete: `set null`,
}),
```

Add the import at the top:
```typescript
import { sandboxes } from '@TDB/schemas/sandboxes'
```

Add index to the index array:
```typescript
index(`threads_sandbox_id_idx`).on(table.sandboxId),
```

Add relation to `threadsRelations`:
```typescript
sandbox: one(sandboxes, { fields: [threads.sandboxId], references: [sandboxes.id] }),
```

- [ ] **Step 2: Update sandboxes relations (reverse side)**

In `repos/database/src/schemas/sandboxes.ts`, add to `sandboxesRelations`:
```typescript
threads: many(threads),
```

And the import:
```typescript
import { threads } from '@TDB/schemas/threads'
```

- [ ] **Step 3: Run database type check**

Run: `cd repos/database && pnpm types`
Expected: No type errors

**Note:** The actual `drizzle-kit push` (schema sync to DB) must be run manually by the user — it's interactive and requires confirmation for destructive changes. Do NOT run `pnpm push` automatically.

---

## Phase 3: Backend — WebSocket Shell Endpoint

---

### Task 9: Install ssh2 Dependency

**Files:**
- Modify: `repos/backend/package.json`

- [ ] **Step 1: Install ssh2**

Run: `cd repos/backend && pnpm add ssh2 && pnpm add -D @types/ssh2`

- [ ] **Step 2: Verify build still works**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

---

### Task 10: Ring Buffer Utility

**Files:**
- Create: `repos/backend/src/utils/ringBuffer.ts`
- Create: `repos/backend/src/utils/ringBuffer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// repos/backend/src/utils/ringBuffer.test.ts
import { describe, it, expect } from 'vitest'
import { RingBuffer } from './ringBuffer'

describe('RingBuffer', () => {
  it('stores and drains data', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('hello'))
    buf.write(Buffer.from(' world'))
    const result = buf.drain()
    expect(result.toString()).toBe('hello world')
  })

  it('evicts oldest data when full', () => {
    const buf = new RingBuffer(10) // 10 bytes
    buf.write(Buffer.from('12345'))
    buf.write(Buffer.from('67890'))
    buf.write(Buffer.from('ABCDE'))
    const result = buf.drain()
    // Only last 10 bytes fit
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.toString()).toContain('ABCDE')
  })

  it('returns empty buffer when nothing written', () => {
    const buf = new RingBuffer(1024)
    const result = buf.drain()
    expect(result.length).toBe(0)
  })

  it('clears after drain', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('data'))
    buf.drain()
    const result = buf.drain()
    expect(result.length).toBe(0)
  })

  it('reports size correctly', () => {
    const buf = new RingBuffer(1024)
    expect(buf.size).toBe(0)
    buf.write(Buffer.from('hello'))
    expect(buf.size).toBe(5)
  })

  it('clears without draining', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('data'))
    buf.clear()
    expect(buf.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/backend && npx vitest run src/utils/ringBuffer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ring buffer**

```typescript
// repos/backend/src/utils/ringBuffer.ts

export class RingBuffer {
  private chunks: Buffer[] = []
  private totalSize = 0
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get size(): number {
    return this.totalSize
  }

  write(data: Buffer) {
    this.chunks.push(data)
    this.totalSize += data.length

    while (this.totalSize > this.maxSize && this.chunks.length > 1) {
      const evicted = this.chunks.shift()!
      this.totalSize -= evicted.length
    }

    if (this.totalSize > this.maxSize && this.chunks.length === 1) {
      const chunk = this.chunks[0]
      const excess = this.totalSize - this.maxSize
      this.chunks[0] = chunk.subarray(excess)
      this.totalSize = this.chunks[0].length
    }
  }

  drain(): Buffer {
    const result = Buffer.concat(this.chunks)
    this.clear()
    return result
  }

  clear() {
    this.chunks = []
    this.totalSize = 0
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/backend && npx vitest run src/utils/ringBuffer.test.ts`
Expected: All tests PASS

---

### Task 11: Shell Session Types

**Files:**
- Create: `repos/backend/src/types/shellSession.types.ts`
- Modify: `repos/backend/src/types/index.ts` (add export if barrel exists)

- [ ] **Step 1: Create shell session types**

```typescript
// repos/backend/src/types/shellSession.types.ts
import type { Client, ClientChannel } from 'ssh2'
import type { WebSocket } from 'ws'
import type { RingBuffer } from '@TBE/utils/ringBuffer'
import type { TerminalParser } from '@tdsk/domain/parser'

export type TShellSession = {
  sessionId: string
  sshClient: Client
  sshStream: ClientChannel
  buffer: RingBuffer
  attachments: Set<WebSocket>
  parser: TerminalParser
  threadId: string
  userId: string
  orgId: string
  sandboxId: string
  ttlTimer: NodeJS.Timeout | null
}

export type TShellControlMsg =
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'signal'; signal: 'SIGINT' | 'SIGTSTP' }
  | { type: 'reconnect'; sessionId: string }

export type TShellServerMsg =
  | { type: 'connected'; sessionId: string; sandboxId: string; runtime: string; threadId: string }
  | { type: 'reconnected'; sessionId: string; bufferedBytes: number }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; message: string }
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

---

### Task 12: Session Broker in Sandbox Service

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`

This task adds shell session management to the existing `SandboxService`. The existing service already has `sessions`, `passwords`, `podActivity` maps and methods like `findRunningPod`, `validatePodOwnership`, `addSession`, `removeSession`. We add a parallel `shellSessions` map for the new persistent SSH sessions.

- [ ] **Step 1: Add shell session map and methods**

Add to `SandboxService` class:

```typescript
// New property alongside existing maps
private shellSessions = new Map<string, TShellSession>()
private readonly SHELL_TTL_MS = 5 * 60 * 1000 // 5 minutes
private readonly RING_BUFFER_SIZE = 1024 * 1024 // 1MB
private eventBatchTimers = new Map<string, NodeJS.Timeout>()
private eventBatches = new Map<string, TParsedEvent[]>()
```

Add these methods:

```typescript
getShellSession(sessionId: string): TShellSession | undefined {
  return this.shellSessions.get(sessionId)
}

addShellSession(session: TShellSession) {
  this.shellSessions.set(session.sessionId, session)
}

removeShellSession(sessionId: string) {
  const session = this.shellSessions.get(sessionId)
  if (!session) return

  if (session.ttlTimer) clearTimeout(session.ttlTimer)
  this.clearEventBatch(sessionId)

  try { session.sshStream.close() } catch {}
  try { session.sshClient.end() } catch {}

  session.buffer.clear()
  session.attachments.clear()
  this.shellSessions.delete(sessionId)
}

attachToShellSession(sessionId: string, ws: WebSocket): TShellSession | undefined {
  const session = this.shellSessions.get(sessionId)
  if (!session) return undefined

  if (session.ttlTimer) {
    clearTimeout(session.ttlTimer)
    session.ttlTimer = null
  }

  session.attachments.add(ws)
  return session
}

detachFromShellSession(sessionId: string, ws: WebSocket) {
  const session = this.shellSessions.get(sessionId)
  if (!session) return

  session.attachments.delete(ws)

  if (session.attachments.size === 0) {
    session.ttlTimer = setTimeout(() => {
      this.flushEventBatch(sessionId)
      this.removeShellSession(sessionId)
    }, this.SHELL_TTL_MS)
  }
}

findShellSessionForSandbox(sandboxId: string, userId: string): TShellSession | undefined {
  for (const session of this.shellSessions.values()) {
    if (session.sandboxId === sandboxId && session.userId === userId) return session
  }
  return undefined
}
```

- [ ] **Step 2: Add event batching methods for thread persistence**

```typescript
queueEventForPersistence(sessionId: string, event: TParsedEvent) {
  let batch = this.eventBatches.get(sessionId)
  if (!batch) {
    batch = []
    this.eventBatches.set(sessionId, batch)
  }
  batch.push(event)

  if (batch.length >= 20) {
    this.flushEventBatch(sessionId)
    return
  }

  if (!this.eventBatchTimers.has(sessionId)) {
    const timer = setTimeout(() => this.flushEventBatch(sessionId), 2000)
    this.eventBatchTimers.set(sessionId, timer)
  }
}

async flushEventBatch(sessionId: string) {
  const timer = this.eventBatchTimers.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    this.eventBatchTimers.delete(sessionId)
  }

  const batch = this.eventBatches.get(sessionId)
  if (!batch || batch.length === 0) return

  this.eventBatches.delete(sessionId)

  const session = this.shellSessions.get(sessionId)
  if (!session) return

  try {
    const messages = batch.map(event => ({
      threadId: session.threadId,
      orgId: session.orgId,
      type: event.type,
      content: event,
    }))
    await this.db.services.message.createMany(messages)
  } catch (err) {
    // Log error but don't crash — persistence is best-effort
    console.error(`[ShellSession] Failed to persist ${batch.length} events for session ${sessionId}:`, err)
  }
}

private clearEventBatch(sessionId: string) {
  const timer = this.eventBatchTimers.get(sessionId)
  if (timer) clearTimeout(timer)
  this.eventBatchTimers.delete(sessionId)
  this.eventBatches.delete(sessionId)
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

---

### Task 13: WebSocket Shell Endpoint

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

This is the core endpoint. Follow the same structure as `onTunnelConnect.ts` but use `ssh2` instead of TCP, and wire up the session broker + parser.

- [ ] **Step 1: Implement onShellConnect**

```typescript
// repos/backend/src/endpoints/sandboxes/onShellConnect.ts
import { Client } from 'ssh2'
import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { TApp } from '@TBE/types'
import { TerminalParser } from '@tdsk/domain/parser'
import { RingBuffer } from '@TBE/utils/ringBuffer'
import type { TShellSession, TShellControlMsg } from '@TBE/types/shellSession.types'

const BACKPRESSURE_THRESHOLD = 64 * 1024 // 64KB
const WS_PING_INTERVAL = 30_000
const SSH_KEEPALIVE_INTERVAL = 15_000

export async function onShellConnect(ws: WebSocket, req: IncomingMessage, app: TApp) {
  let closed = false
  let pingInterval: NodeJS.Timeout | null = null

  const cleanup = (reason: string) => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)

    const sessionId = (ws as any).__sessionId as string | undefined
    if (sessionId) {
      app.sbService.detachFromShellSession(sessionId, ws)
    }

    try {
      ws.send(JSON.stringify({ type: 'disconnected', reason }))
    } catch {}
    try { ws.close() } catch {}
  }

  // 1. Extract sandbox ID from URL
  const urlPath = req.url ?? ''
  const match = urlPath.match(/\/(\w+)\/shell/)
  if (!match) {
    ws.close(4000, 'Invalid path')
    return
  }
  const sandboxId = match[1]

  // 2. Parse query params
  const url = new URL(urlPath, 'http://localhost')
  const cols = parseInt(url.searchParams.get('cols') ?? '80', 10)
  const rows = parseInt(url.searchParams.get('rows') ?? '24', 10)
  const shouldRun = url.searchParams.get('run') === 'true'
  const reconnectSessionId = url.searchParams.get('sessionId')

  // 3. Authenticate
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    ws.close(4001, 'Missing authorization')
    return
  }
  const token = authHeader.slice(7)

  let orgId: string
  let userId: string
  try {
    const authResult = await app.sbService.authenticateToken(token)
    orgId = authResult.orgId
    userId = authResult.userId
  } catch {
    ws.close(4001, 'Invalid token')
    return
  }

  // 4. Handle reconnection to existing session
  if (reconnectSessionId) {
    const existing = app.sbService.getShellSession(reconnectSessionId)
    if (existing && existing.userId === userId && existing.sandboxId === sandboxId) {
      const session = app.sbService.attachToShellSession(reconnectSessionId, ws)!
      ;(ws as any).__sessionId = reconnectSessionId

      // Flush ring buffer
      const buffered = session.buffer.drain()
      if (buffered.length > 0) {
        ws.send(buffered)
      }

      ws.send(JSON.stringify({
        type: 'reconnected',
        sessionId: reconnectSessionId,
        bufferedBytes: buffered.length,
      }))

      wireWebSocket(ws, session, app, cleanup)
      return
    }
    // Session expired or invalid — fall through to create new
  }

  // 5. Check for existing session for this sandbox+user
  const existingSession = app.sbService.findShellSessionForSandbox(sandboxId, userId)
  if (existingSession) {
    app.sbService.attachToShellSession(existingSession.sessionId, ws)
    ;(ws as any).__sessionId = existingSession.sessionId

    const buffered = existingSession.buffer.drain()
    if (buffered.length > 0) ws.send(buffered)

    ws.send(JSON.stringify({
      type: 'reconnected',
      sessionId: existingSession.sessionId,
      bufferedBytes: buffered.length,
    }))

    wireWebSocket(ws, existingSession, app, cleanup)
    return
  }

  // 6. Find running pod
  const podName = app.sbService.findRunningPod(sandboxId, orgId)
  if (!podName) {
    ws.close(4004, 'No running pod')
    return
  }

  try {
    app.sbService.validatePodOwnership(podName, orgId)
  } catch {
    ws.close(4003, 'Not authorized')
    return
  }

  // 7. Get pod IP and SSH password
  const kube = app.sbService.getKube()
  const pod = await kube.getPod(podName)
  const podIp = pod?.status?.podIP
  if (!podIp) {
    ws.close(4004, 'Pod not ready')
    return
  }

  let password = app.sbService.getPassword(podName)
  if (!password) {
    password = await app.sbService.recoverPassword(podName)
  }
  if (!password) {
    ws.close(4005, 'Cannot recover SSH credentials')
    return
  }

  // 8. Get sandbox config for runtime info
  const sandbox = await app.db.services.sandbox.getById(sandboxId)
  const runtime = sandbox?.config?.runtime ?? 'custom'
  const runtimeCommand = sandbox?.config?.runtimeCommand

  // 9. Create thread for session history
  let threadId: string
  try {
    const thread = await app.db.services.thread.create({
      name: `${sandbox?.name ?? 'Sandbox'} — ${new Date().toISOString()}`,
      sandboxId,
      orgId,
      userId,
      projectId: sandbox?.projectId ?? undefined,
      meta: { runtime, shellSessionId: '' }, // updated below
    })
    threadId = thread.id
  } catch (err) {
    ws.close(4005, 'Failed to create session thread')
    return
  }

  // 10. Establish SSH connection
  const sessionId = nanoid(16)
  const sshClient = new Client()

  sshClient.on('ready', () => {
    sshClient.shell(
      { term: 'xterm-256color', cols, rows },
      (err, stream) => {
        if (err || !stream) {
          ws.close(4005, 'Shell allocation failed')
          sshClient.end()
          return
        }

        // Create parser for this session
        const parser = new TerminalParser({
          runtime,
          onEvent: (event) => {
            app.sbService.queueEventForPersistence(sessionId, event)
          },
          onToolState: () => {}, // backend doesn't need tool state
        })

        // Create session
        const session: TShellSession = {
          sessionId,
          sshClient,
          sshStream: stream,
          buffer: new RingBuffer(1024 * 1024), // 1MB
          attachments: new Set([ws]),
          parser,
          threadId,
          userId,
          orgId,
          sandboxId,
          ttlTimer: null,
        }

        app.sbService.addShellSession(session)
        ;(ws as any).__sessionId = sessionId

        // Update thread meta with session ID
        app.db.services.thread.update(threadId, {
          meta: { runtime, shellSessionId: sessionId },
        }).catch(() => {})

        // Send connected message
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId,
          sandboxId,
          runtime,
          threadId,
        }))

        // Execute runtime command if requested
        if (shouldRun && runtimeCommand) {
          stream.write(`${runtimeCommand}\n`)
        }

        // Wire up SSH stream → WebSocket fan-out
        stream.on('data', (data: Buffer) => {
          const dataStr = data.toString()
          parser.write(dataStr)

          if (session.attachments.size === 0) {
            session.buffer.write(data)
            return
          }

          for (const client of session.attachments) {
            if (client.readyState === 1) { // OPEN
              client.send(data)
              // Backpressure
              if ((client as any).bufferedAmount > BACKPRESSURE_THRESHOLD) {
                stream.pause()
                const resume = () => {
                  if ((client as any).bufferedAmount <= BACKPRESSURE_THRESHOLD) {
                    stream.resume()
                  } else {
                    setTimeout(resume, 16)
                  }
                }
                setTimeout(resume, 16)
              }
            }
          }
        })

        stream.on('close', () => {
          parser.flush()
          app.sbService.flushEventBatch(sessionId)
          cleanup('SSH stream closed')
          app.sbService.removeShellSession(sessionId)
        })

        stream.on('error', (err: Error) => {
          cleanup(`SSH error: ${err.message}`)
        })

        wireWebSocket(ws, session, app, cleanup)
      }
    )
  })

  sshClient.on('error', (err) => {
    ws.close(4005, `SSH connection failed: ${err.message}`)
  })

  sshClient.connect({
    host: podIp,
    port: 2222,
    username: 'sandbox',
    password,
    keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
    readyTimeout: 10_000,
  })
}

function wireWebSocket(
  ws: WebSocket,
  session: TShellSession,
  app: TApp,
  cleanup: (reason: string) => void
) {
  // WebSocket → SSH stdin
  ws.on('message', (data, isBinary) => {
    if (typeof data === 'string' || !isBinary) {
      // Text frame — control message
      try {
        const msg = JSON.parse(data.toString()) as TShellControlMsg
        if (msg.type === 'resize') {
          session.sshStream.setWindow(msg.rows, msg.cols, msg.rows * 16, msg.cols * 8)
        } else if (msg.type === 'signal') {
          if (msg.signal === 'SIGINT') session.sshStream.write('\x03')
          else if (msg.signal === 'SIGTSTP') session.sshStream.write('\x1a')
        }
      } catch {}
      return
    }

    // Binary frame — stdin
    const inputStr = data.toString()
    session.parser.trackInput(inputStr)
    session.sshStream.write(data)
    app.sbService.updateActivity(session.sandboxId)
  })

  ws.on('close', () => cleanup('WebSocket closed'))
  ws.on('error', (err) => cleanup(`WebSocket error: ${err.message}`))

  // Keepalive pings
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) ws.ping()
  }, WS_PING_INTERVAL)

  ws.on('close', () => clearInterval(pingInterval))
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: No type errors (there may be minor issues to fix based on exact service method signatures — adjust as needed)

---

### Task 14: Route Registration

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxes.ts`

- [ ] **Step 1: Add shell WebSocket route**

Check how the tunnel WebSocket route is registered in the sandboxes endpoint config. Add the shell route following the same pattern. The registration looks like:

```typescript
import { onShellConnect } from './onShellConnect'
```

And add to the WebSocket routes alongside the existing tunnel:
```typescript
// Alongside existing: router.ws('/:id/tunnel', onTunnelConnect)
router.ws('/:id/shell', onShellConnect)
```

The exact registration mechanism depends on the app's WebSocket setup — follow the same pattern as the tunnel endpoint.

- [ ] **Step 2: Verify backend builds**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

---

## Phase 4: Frontend — Threads App

All frontend work is in `repos/threads/`. The existing scaffold has auth, theming, routing, API layer, and Jotai state management already working.

**Critical pattern reminder**: Loaders → Actions → Jotai → Components. No useEffect for data fetching. API calls only through actions.

---

### Task 15: Install Frontend Dependencies

**Files:**
- Modify: `repos/threads/package.json`

- [ ] **Step 1: Install ghostty-web**

Run: `cd repos/threads && pnpm add ghostty-web`

- [ ] **Step 2: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 16: Session State Atoms & Selectors

**Files:**
- Create: `repos/threads/src/state/sessions.ts`
- Modify: `repos/threads/src/state/index.ts` (add export)
- Modify: `repos/threads/src/state/accessors.ts` (add session accessors)
- Modify: `repos/threads/src/state/selectors.ts` (add session selectors)

- [ ] **Step 1: Create session atoms**

```typescript
// repos/threads/src/state/sessions.ts
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import type { TParsedEvent, TToolState } from '@tdsk/domain/parser'

export type TSandboxStatus = 'stopped' | 'starting' | 'running' | 'error'

export type TOpenSession = {
  sandboxId: string
  sessionId: string
  threadId: string
  runtime: string
}

export const sessionEventsAtom = atomWithReset<Map<string, TParsedEvent[]>>(new Map())
export const sessionToolStateAtom = atomWithReset<Map<string, TToolState>>(new Map())
export const sandboxStatusAtom = atomWithReset<Map<string, TSandboxStatus>>(new Map())
export const openSessionsAtom = atomWithReset<Map<string, TOpenSession>>(new Map())
export const activeSessionAtom = atomWithReset<string | null>(null)
```

- [ ] **Step 2: Add accessors**

Add to `repos/threads/src/state/accessors.ts`:

```typescript
import {
  sessionEventsAtom,
  sessionToolStateAtom,
  sandboxStatusAtom,
  openSessionsAtom,
  activeSessionAtom,
} from '@TTH/state/sessions'

export const getSessionEvents = (sandboxId: string) => store.get(sessionEventsAtom).get(sandboxId) ?? []
export const setSessionEvents = (sandboxId: string, events: TParsedEvent[]) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.set(sandboxId, events)
  store.set(sessionEventsAtom, map)
}
export const appendSessionEvent = (sandboxId: string, event: TParsedEvent) => {
  const map = new Map(store.get(sessionEventsAtom))
  const events = [...(map.get(sandboxId) ?? []), event]
  map.set(sandboxId, events)
  store.set(sessionEventsAtom, map)
}

export const getToolState = (sandboxId: string) => store.get(sessionToolStateAtom).get(sandboxId) ?? 'idle'
export const setToolState = (sandboxId: string, state: TToolState) => {
  const map = new Map(store.get(sessionToolStateAtom))
  map.set(sandboxId, state)
  store.set(sessionToolStateAtom, map)
}

export const getOpenSessions = () => store.get(openSessionsAtom)
export const setOpenSession = (sandboxId: string, session: TOpenSession) => {
  const map = new Map(store.get(openSessionsAtom))
  map.set(sandboxId, session)
  store.set(openSessionsAtom, map)
}
export const removeOpenSession = (sandboxId: string) => {
  const map = new Map(store.get(openSessionsAtom))
  map.delete(sandboxId)
  store.set(openSessionsAtom, map)
}

export const getActiveSession = () => store.get(activeSessionAtom)
export const setActiveSession = (sandboxId: string | null) => store.set(activeSessionAtom, sandboxId)
```

- [ ] **Step 3: Add selectors**

Add to `repos/threads/src/state/selectors.ts`:

```typescript
import {
  sessionEventsAtom,
  sessionToolStateAtom,
  openSessionsAtom,
  activeSessionAtom,
} from '@TTH/state/sessions'

export const useSessionEvents = (sandboxId: string) => {
  const [eventsMap] = useRecState(sessionEventsAtom)
  return eventsMap.get(sandboxId) ?? []
}

export const useToolState = (sandboxId: string) => {
  const [stateMap] = useRecState(sessionToolStateAtom)
  return stateMap.get(sandboxId) ?? ('idle' as TToolState)
}

export const useOpenSessions = () => useRecState(openSessionsAtom)[0]
export const useActiveSession = () => useRecState(activeSessionAtom)[0]
```

- [ ] **Step 4: Export from barrel**

Add to `repos/threads/src/state/index.ts`:
```typescript
export * from './sessions'
```

- [ ] **Step 5: Verify types**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 17: Session Actions

**Files:**
- Create: `repos/threads/src/actions/sessions/openSession.ts`
- Create: `repos/threads/src/actions/sessions/closeSession.ts`
- Create: `repos/threads/src/actions/sessions/sendInput.ts`
- Create: `repos/threads/src/actions/sessions/index.ts`

These actions manage WebSocket connections and parser lifecycle. They call ApiService for HTTP requests and manage Jotai state via accessors.

- [ ] **Step 1: Create openSession action**

```typescript
// repos/threads/src/actions/sessions/openSession.ts
import { TerminalParser } from '@tdsk/domain/parser'
import type { TParsedEvent, TToolState } from '@tdsk/domain/parser'
import {
  appendSessionEvent,
  setToolState,
  setOpenSession,
  setActiveSession,
  removeOpenSession,
} from '@TTH/state/accessors'
import { sandboxApi } from '@TTH/services'

// Module-level maps for WebSocket and parser instances (not Jotai — not serializable)
const connections = new Map<string, WebSocket>()
const parsers = new Map<string, TerminalParser>()
const rawBuffers = new Map<string, string[]>()

export const getConnection = (sandboxId: string) => connections.get(sandboxId)
export const getParser = (sandboxId: string) => parsers.get(sandboxId)
export const getRawBuffer = (sandboxId: string) => rawBuffers.get(sandboxId) ?? []

export type TOpenSessionOpts = {
  sandboxId: string
  orgId: string
  run?: boolean
  reconnectSessionId?: string | null
}

export const openSession = async (opts: TOpenSessionOpts) => {
  const { sandboxId, orgId, run = true } = opts

  // Ensure pod is running
  const connectResult = await sandboxApi.connect(orgId, sandboxId)
  if (!connectResult.ok) {
    throw new Error(connectResult.error ?? 'Failed to connect to sandbox')
  }

  // Build WebSocket URL
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ cols: '80', rows: '24' })
  if (run) params.set('run', 'true')

  const storedSessionId = opts.reconnectSessionId ?? sessionStorage.getItem(`shell_${sandboxId}`)
  if (storedSessionId) params.set('sessionId', storedSessionId)

  const wsUrl = `${proto}//${location.host}/_/sandboxes/${sandboxId}/shell?${params}`

  const ws = new WebSocket(wsUrl)
  connections.set(sandboxId, ws)
  rawBuffers.set(sandboxId, [])

  return new Promise<void>((resolve, reject) => {
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      // Parser will be created after we get the connected/reconnected message
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Control message
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'connected' || msg.type === 'reconnected') {
            sessionStorage.setItem(`shell_${sandboxId}`, msg.sessionId)

            // Create parser
            const runtime = msg.runtime ?? 'custom'
            const parser = new TerminalParser({
              runtime,
              onEvent: (parsedEvent: TParsedEvent) => appendSessionEvent(sandboxId, parsedEvent),
              onToolState: (state: TToolState) => setToolState(sandboxId, state),
              debounceMs: 100,
            })
            parsers.set(sandboxId, parser)

            setOpenSession(sandboxId, {
              sandboxId,
              sessionId: msg.sessionId,
              threadId: msg.threadId ?? '',
              runtime,
            })
            setActiveSession(sandboxId)
            resolve()
          } else if (msg.type === 'error') {
            reject(new Error(msg.message))
          }
        } catch {}
        return
      }

      // Binary frame — PTY data
      const data = new TextDecoder().decode(event.data)
      rawBuffers.get(sandboxId)?.push(data)
      parsers.get(sandboxId)?.write(data)
    }

    ws.onclose = () => {
      parsers.get(sandboxId)?.flush()
      connections.delete(sandboxId)
      parsers.delete(sandboxId)
    }

    ws.onerror = () => reject(new Error('WebSocket connection failed'))
  })
}
```

- [ ] **Step 2: Create closeSession action**

```typescript
// repos/threads/src/actions/sessions/closeSession.ts
import { removeOpenSession, getActiveSession, setActiveSession } from '@TTH/state/accessors'
import { getConnection } from './openSession'

export const closeSession = (sandboxId: string) => {
  const ws = getConnection(sandboxId)
  if (ws) {
    ws.close()
  }
  removeOpenSession(sandboxId)

  if (getActiveSession() === sandboxId) {
    setActiveSession(null)
  }

  sessionStorage.removeItem(`shell_${sandboxId}`)
}
```

- [ ] **Step 3: Create sendInput action**

```typescript
// repos/threads/src/actions/sessions/sendInput.ts
import { getConnection, getParser } from './openSession'

export const sendInput = (sandboxId: string, text: string) => {
  const ws = getConnection(sandboxId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  const parser = getParser(sandboxId)
  parser?.trackInput(text)

  const encoder = new TextEncoder()
  ws.send(encoder.encode(text))
}

export const sendControl = (sandboxId: string, msg: Record<string, unknown>) => {
  const ws = getConnection(sandboxId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(msg))
}

export const approvePermission = (sandboxId: string) => sendInput(sandboxId, 'y\n')
export const denyPermission = (sandboxId: string) => sendInput(sandboxId, 'n\n')
```

- [ ] **Step 4: Create barrel export**

```typescript
// repos/threads/src/actions/sessions/index.ts
export { openSession, getConnection, getRawBuffer } from './openSession'
export { closeSession } from './closeSession'
export { sendInput, sendControl, approvePermission, denyPermission } from './sendInput'
```

- [ ] **Step 5: Verify types**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 18: Sandbox API Actions

**Files:**
- Create: `repos/threads/src/actions/sandboxes/listSandboxes.ts`
- Create: `repos/threads/src/actions/sandboxes/connectSandbox.ts`
- Create: `repos/threads/src/actions/sandboxes/index.ts`

These wrap the existing sandbox API endpoints for use in the Threads app.

- [ ] **Step 1: Create sandbox API actions**

```typescript
// repos/threads/src/actions/sandboxes/listSandboxes.ts
import { sandboxApi } from '@TTH/services'

export type TListSandboxesOpts = { orgId: string }

export const listSandboxes = async (opts: TListSandboxesOpts) => {
  return sandboxApi.list(opts.orgId)
}
```

```typescript
// repos/threads/src/actions/sandboxes/connectSandbox.ts
import { sandboxApi } from '@TTH/services'

export type TConnectSandboxOpts = { orgId: string; sandboxId: string }

export const connectSandbox = async (opts: TConnectSandboxOpts) => {
  return sandboxApi.connect(opts.orgId, opts.sandboxId)
}
```

```typescript
// repos/threads/src/actions/sandboxes/index.ts
export { listSandboxes } from './listSandboxes'
export { connectSandbox } from './connectSandbox'
```

- [ ] **Step 2: Ensure sandboxApi service methods exist**

Check `repos/threads/src/services/api.ts` — if sandbox methods (list, connect, status) are not yet implemented, add them following the existing `ApiService` pattern. These call the standard `/_/sandboxes` endpoints.

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 19: Thread History Actions

**Files:**
- Create: `repos/threads/src/actions/threads/loadThreadHistory.ts`
- Create: `repos/threads/src/actions/threads/viewThread.ts`
- Create: `repos/threads/src/actions/threads/index.ts`

- [ ] **Step 1: Create thread history actions**

```typescript
// repos/threads/src/actions/threads/loadThreadHistory.ts
import { threadApi } from '@TTH/services'

export type TLoadThreadHistoryOpts = { orgId: string; sandboxId: string }

export const loadThreadHistory = async (opts: TLoadThreadHistoryOpts) => {
  return threadApi.list({ orgId: opts.orgId, sandboxId: opts.sandboxId })
}
```

```typescript
// repos/threads/src/actions/threads/viewThread.ts
import { threadApi } from '@TTH/services'

export type TViewThreadOpts = { orgId: string; threadId: string }

export const viewThread = async (opts: TViewThreadOpts) => {
  return threadApi.getMessages(opts.orgId, opts.threadId)
}
```

```typescript
// repos/threads/src/actions/threads/index.ts
export { loadThreadHistory } from './loadThreadHistory'
export { viewThread } from './viewThread'
```

- [ ] **Step 2: Ensure threadApi service methods exist**

Check `repos/threads/src/services/` — add thread API service methods if they don't exist. These call `/_/threads?sandboxId=:id` and `/_/threads/:id/messages`.

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 20: Routes & Loaders

**Files:**
- Modify: `repos/threads/src/routes/Routes.tsx`

- [ ] **Step 1: Update route structure**

Update the existing routes to add the session route:

```typescript
// Add to the route config alongside existing routes:
{
  path: 'session/:sandboxId',
  lazy: () => import('@TTH/pages/Session/Session'),
}
```

The home route (`/`) will render `SandboxList`. The `session/:sandboxId` route renders `SessionView`.

- [ ] **Step 2: Create route loader for sandbox list**

Following the admin pattern with `criticalFetch` / `safeFetch`, create a loader for the home route that loads the sandbox list via actions (not direct API calls):

```typescript
// In the home route loader:
export const homeLoader = async () => {
  const user = getUser()
  if (!user?.orgId) return null
  await listSandboxes({ orgId: user.orgId })
  return null
}
```

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 21: SandboxList Component (Mobile Home / Desktop Sidebar)

**Files:**
- Create: `repos/threads/src/components/SandboxList/SandboxList.tsx`
- Create: `repos/threads/src/components/SandboxList/SandboxCard.tsx`
- Create: `repos/threads/src/components/SandboxList/ThreadHistory.tsx`
- Create: `repos/threads/src/components/SandboxList/index.ts`

- [ ] **Step 1: Create SandboxCard component**

Renders a single sandbox with status indicator, name, runtime icon, and tap handler. Shows expandable thread history underneath.

Key patterns:
- Status dot color: green (running), amber (needs permission), gray (idle), dark (stopped)
- Tapping a running sandbox calls `openSession` action
- Tapping a stopped sandbox shows confirmation before calling `connectSandbox` then `openSession`
- Expand chevron toggles `ThreadHistory` visibility

- [ ] **Step 2: Create ThreadHistory component**

Expandable list of past session threads for a sandbox. Loads on expand via `loadThreadHistory` action. Each thread item shows name, date, tap to open read-only view via `viewThread` action.

- [ ] **Step 3: Create SandboxList container**

Wraps `SandboxCard[]` with `OrgSelector` and `OpenSessionStrip`. Uses `useQuery` with `refetchInterval: 30_000` for sandbox status polling (configured in loader/action, not useEffect).

- [ ] **Step 4: Verify types and visual**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

---

### Task 22: SessionTabs / OpenSessionStrip Components

**Files:**
- Create: `repos/threads/src/components/SessionTabs/SessionTabs.tsx` (desktop)
- Create: `repos/threads/src/components/SessionTabs/OpenSessionStrip.tsx` (mobile)
- Create: `repos/threads/src/components/SessionTabs/index.ts`

- [ ] **Step 1: Create SessionTabs (desktop)**

Tab bar showing open sessions. Each tab shows:
- Status dot (color from `useToolState`)
- Sandbox name
- Notification badge (amber `!` for permission state)
- Close button (calls `closeSession` action)

Active tab has bottom border highlight. Clicking a tab calls `setActiveSession`.

- [ ] **Step 2: Create OpenSessionStrip (mobile)**

Horizontal scrollable pill strip. Same data as SessionTabs but rendered as pills. Tap to switch active session.

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`

---

### Task 23: ChatView Component

**Files:**
- Create: `repos/threads/src/components/ChatView/ChatView.tsx`
- Create: `repos/threads/src/components/ChatView/UserBubble.tsx`
- Create: `repos/threads/src/components/ChatView/AiBubble.tsx`
- Create: `repos/threads/src/components/ChatView/ToolCallCard.tsx`
- Create: `repos/threads/src/components/ChatView/PermissionCard.tsx`
- Create: `repos/threads/src/components/ChatView/DiffCard.tsx`
- Create: `repos/threads/src/components/ChatView/ErrorCard.tsx`
- Create: `repos/threads/src/components/ChatView/ThinkingIndicator.tsx`
- Create: `repos/threads/src/components/ChatView/UnknownBlock.tsx`
- Create: `repos/threads/src/components/ChatView/index.ts`

- [ ] **Step 1: Create event renderer components**

Each component renders one `TParsedEvent` type:
- `UserBubble`: Right-aligned bubble for `input` events
- `AiBubble`: Left-aligned bubble with markdown for `text` events (uses `react-markdown`)
- `ToolCallCard`: Collapsible card for `tool-call` events (icon, tool name, target, status badge)
- `PermissionCard`: Highlighted card for `permission` events (approve/deny buttons call `approvePermission`/`denyPermission` actions)
- `DiffCard`: Expandable diff view for `diff` events (green additions, red removals)
- `ErrorCard`: Red-bordered card for `error` events
- `ThinkingIndicator`: Animated dots for `thinking` events
- `UnknownBlock`: Monospace text block for `unknown` events (graceful fallback)

- [ ] **Step 2: Create ChatView container**

```typescript
// repos/threads/src/components/ChatView/ChatView.tsx
// Reads events from useSessionEvents(sandboxId)
// Maps each event to its renderer component via switch on event.type
// Auto-scrolls to bottom on new events
// Supports read-only mode (for thread history — no interactive permission buttons)
```

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`

---

### Task 24: TerminalView Component

**Files:**
- Create: `repos/threads/src/components/TerminalView/TerminalView.tsx`
- Create: `repos/threads/src/components/TerminalView/index.ts`

- [ ] **Step 1: Initialize ghostty-web at app startup**

Add `init()` call in the app bootstrap (e.g., in `src/index.tsx` before React render):

```typescript
import { init } from 'ghostty-web'
// Call during app bootstrap, before React renders
init().catch(console.error)
```

- [ ] **Step 2: Create TerminalView component**

```typescript
// repos/threads/src/components/TerminalView/TerminalView.tsx
// - Creates ghostty-web Terminal instance on mount
// - Uses FitAddon for auto-resize
// - Reads raw buffer from getRawBuffer(sandboxId) for replay on first mount
// - Wires onData → sendInput action (binary stdin)
// - Wires onResize → sendControl action ({ type: 'resize', cols, rows })
// - Subscribes to WebSocket binary messages and writes to terminal
// - Hidden (display:none) when not active tab — not unmounted (preserves scrollback)
```

Key implementation detail: The TerminalView needs to listen to the same WebSocket that ChatView uses. The `getConnection(sandboxId)` accessor provides the WebSocket reference. The component adds its own `onmessage` listener for binary data and writes to the ghostty-web terminal.

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`

---

### Task 25: SmartInput Component

**Files:**
- Create: `repos/threads/src/components/SmartInput/SmartInput.tsx`
- Create: `repos/threads/src/components/SmartInput/index.ts`

- [ ] **Step 1: Create SmartInput**

Reads `useToolState(sandboxId)` and renders the appropriate input UI:

```typescript
// repos/threads/src/components/SmartInput/SmartInput.tsx
// Switch on toolState:
//
// 'idle':
//   Message input + "Start" button (sends runtimeCommand via sendInput)
//
// 'prompt':
//   Message input + send button
//   On submit: sendInput(sandboxId, text + '\n')
//
// 'working':
//   Disabled input showing "Working..."
//   Stop button → sendControl(sandboxId, { type: 'signal', signal: 'SIGINT' })
//
// 'permission':
//   Approve/Deny buttons
//   Approve → approvePermission(sandboxId)
//   Deny → denyPermission(sandboxId)
//
// 'interactive':
//   Monospace text input, passes each keystroke via sendInput
```

All button/submit handlers call actions, never ApiService directly.

- [ ] **Step 2: Verify types**

Run: `cd repos/threads && pnpm types`

---

### Task 26: SessionView Container

**Files:**
- Create: `repos/threads/src/pages/Session/Session.tsx`
- Create: `repos/threads/src/pages/Session/index.ts`

- [ ] **Step 1: Create SessionView page**

Container component that composes:
- `SessionHeader` (back button on mobile, sandbox name, chat/terminal toggle)
- `ChatView` or `TerminalView` (toggle state, local — not Jotai)
- `SmartInput` (hidden in terminal mode and in thread history read-only mode)

```typescript
// repos/threads/src/pages/Session/Session.tsx
// - Reads sandboxId from route params
// - Reads open session state from useOpenSessions
// - If no open session: show "Connecting..." or "Disconnected" state
// - Toggle between ChatView and TerminalView via local state
// - On mobile: fills full screen with back button navigation
// - On desktop: fills main content area (sidebar is separate)
```

- [ ] **Step 2: Verify types**

Run: `cd repos/threads && pnpm types`

---

### Task 27: Responsive Layout

**Files:**
- Modify: `repos/threads/src/pages/Layout/Layout.tsx` (existing — currently has sidebar placeholder)
- Modify: `repos/threads/src/components/Sidebar/Sidebar.tsx` (existing)
- Modify: `repos/threads/src/components/Sidebar/DesktopSidebar.tsx` (existing — placeholder text)

- [ ] **Step 1: Wire desktop sidebar with SandboxList**

Replace the placeholder text in `DesktopSidebar.tsx` with the `SandboxList` component. Desktop layout: sidebar on left (fixed width), session tabs above main content, session view fills remaining space.

- [ ] **Step 2: Wire mobile layout**

Mobile layout uses the existing stack navigation. Home screen renders `SandboxList` with `OpenSessionStrip`. Tapping a sandbox pushes the `Session` route.

- [ ] **Step 3: Add responsive breakpoint logic**

Use MUI's `useMediaQuery` or `useTheme().breakpoints` to switch between mobile and desktop layouts at 768px:

```typescript
const isMobile = useMediaQuery(theme.breakpoints.down('md'))
```

- [ ] **Step 4: Verify types and visual**

Run: `cd repos/threads && pnpm types`

---

### Task 28: In-App Notifications

**Files:**
- Modify components from Tasks 21-22 to add badge/dot logic

- [ ] **Step 1: Add status dot colors to SandboxCard and SessionTabs**

Based on `useToolState(sandboxId)`:
- `'working'` → green dot
- `'permission'` → amber dot + `!` badge
- `'prompt'` or `'idle'` → gray dot
- No session → dark dot (stopped)

- [ ] **Step 2: Add toast notifications**

When `useToolState` transitions to `'permission'` for a sandbox that is NOT the active session, fire a toast via sonner:

```typescript
toast.warning(`${sandboxName} needs permission`)
```

This logic belongs in the session actions (when parser emits a permission event and the sandbox is not active), NOT in useEffect.

- [ ] **Step 3: Verify types**

Run: `cd repos/threads && pnpm types`

---

## Phase 5: Integration Verification

---

### Task 29: End-to-End Type Check

- [ ] **Step 1: Run all type checks**

Run from project root:
```bash
pnpm types
```
Expected: All sub-repos pass type checking (domain, database, backend, threads, and all others)

- [ ] **Step 2: Run all unit tests**

```bash
cd repos/domain && pnpm test
cd repos/backend && pnpm test
cd repos/threads && pnpm test
```
Expected: All existing + new tests pass

- [ ] **Step 3: Run backend build**

```bash
cd repos/backend && pnpm build
```
Expected: Build succeeds

- [ ] **Step 4: Run threads build**

```bash
cd repos/threads && pnpm build
```
Expected: Build succeeds (ghostty-web WASM bundled correctly)

---

## File Map Summary

### New Files

| Path | Purpose |
|---|---|
| `repos/domain/src/parser/types.ts` | ParsedEvent, ToolState, parser types |
| `repos/domain/src/parser/ansiProcessor.ts` | ANSI escape stripping (inline regex) |
| `repos/domain/src/parser/blockSegmenter.ts` | Input/output block splitting |
| `repos/domain/src/parser/patternMatcher.ts` | Pattern matching pipeline |
| `repos/domain/src/parser/matchers/claudeCode.ts` | Claude Code pattern matchers |
| `repos/domain/src/parser/terminalParser.ts` | Pipeline orchestrator |
| `repos/domain/src/parser/index.ts` | Barrel export |
| `repos/domain/src/parser/*.test.ts` | Parser unit tests (4 files) |
| `repos/backend/src/utils/ringBuffer.ts` | Circular buffer for detached replay |
| `repos/backend/src/utils/ringBuffer.test.ts` | Ring buffer tests |
| `repos/backend/src/types/shellSession.types.ts` | Shell session + control message types |
| `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | WebSocket shell endpoint |
| `repos/threads/src/state/sessions.ts` | Session Jotai atoms |
| `repos/threads/src/actions/sessions/*.ts` | Session actions (open, close, input) |
| `repos/threads/src/actions/sandboxes/*.ts` | Sandbox API actions |
| `repos/threads/src/actions/threads/*.ts` | Thread history actions |
| `repos/threads/src/components/SandboxList/*.tsx` | Sandbox list + cards + thread history |
| `repos/threads/src/components/SessionTabs/*.tsx` | Desktop tabs + mobile pills |
| `repos/threads/src/components/ChatView/*.tsx` | Chat event renderers (8 components) |
| `repos/threads/src/components/TerminalView/*.tsx` | ghostty-web terminal wrapper |
| `repos/threads/src/components/SmartInput/*.tsx` | Adaptive input component |
| `repos/threads/src/pages/Session/*.tsx` | Session page container |

### Modified Files

| Path | Change |
|---|---|
| `repos/domain/src/types/index.ts` | Add parser type export |
| `repos/database/src/schemas/threads.ts` | Add `sandboxId` column + relation |
| `repos/database/src/schemas/sandboxes.ts` | Add reverse `threads` relation |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Add shell session broker methods |
| `repos/backend/src/endpoints/sandboxes/sandboxes.ts` | Register `/shell` route |
| `repos/backend/package.json` | Add `ssh2` dependency |
| `repos/threads/package.json` | Add `ghostty-web` dependency |
| `repos/threads/src/state/accessors.ts` | Add session accessors |
| `repos/threads/src/state/selectors.ts` | Add session selectors |
| `repos/threads/src/state/index.ts` | Export sessions |
| `repos/threads/src/routes/Routes.tsx` | Add session route |
| `repos/threads/src/pages/Layout/Layout.tsx` | Wire responsive layout |
| `repos/threads/src/components/Sidebar/*.tsx` | Wire SandboxList into sidebar |
| `repos/threads/src/index.tsx` | Add ghostty-web init() |
