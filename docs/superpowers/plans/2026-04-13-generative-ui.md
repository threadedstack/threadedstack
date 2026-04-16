# Generative UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an async AI interpretation layer that converts raw terminal output from sandbox AI tools into interactive React component trees, rendered in the Threads chat view.

**Architecture:** Two-phase delivery — raw parsed events broadcast immediately (unchanged pipeline), while a parallel async path buffers events into chunks, applies a skip heuristic, and for interactive chunks calls an AI interpreter via pi-ai. The interpreter returns a JSON component tree broadcast as an upgrade event. Clients match upgrades to raw events by chunkId and render interactive UI with fade-swap animation.

**Tech Stack:** TypeScript, pi-ai (`@mariozechner/pi-ai`), Drizzle ORM, React, Jotai, MUI, Vitest

**Spec:** `docs/superpowers/specs/2026-04-13-generative-ui-design.md`

---

## Phase 1: Domain — Shared Types & Constants

### Task 1: GUI Types

**Files:**
- Create: `repos/domain/src/types/gui.types.ts`
- Modify: `repos/domain/src/types/index.ts` (add export)

- [ ] **Step 1: Create GUI type definitions**

Create `repos/domain/src/types/gui.types.ts`:

```typescript
export type TJsonComponentNode = {
  type: string
  props?: Record<string, unknown>
  children?: (TJsonComponentNode | string)[]
}

export type TJsonComponentTree = TJsonComponentNode

export type TGenerativeUIResult = {
  tree: TJsonComponentTree
}

export type TGuiConfig = {
  enabled: boolean
  providerId: string
  model: string
  maxRetries: number
  systemPrompt?: string
}

export type TOrgConfig = {
  guiConfig?: TGuiConfig
}
```

- [ ] **Step 2: Export from types barrel**

Add to `repos/domain/src/types/index.ts`:

```typescript
export type * from './gui.types.ts'
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: PASS — no type errors

---

### Task 2: GUI Constants

**Files:**
- Create: `repos/domain/src/constants/gui.ts`
- Modify: `repos/domain/src/constants/index.ts` (add export)
- Test: `repos/domain/src/constants/gui.test.ts`

- [ ] **Step 1: Write test for constants**

Create `repos/domain/src/constants/gui.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  InterpreterSystem,
  InteractivePatterns,
  ComponentRegistry,
  AllowedHtmlElements,
  BypassEventTypes,
  BufferedEventTypes,
} from './gui.ts'

describe('GUI constants', () => {
  describe('InterpreterSystem', () => {
    it('should be a non-empty string', () => {
      expect(typeof InterpreterSystem).toBe('string')
      expect(InterpreterSystem.length).toBeGreaterThan(100)
    })

    it('should reference all registry components', () => {
      for (const name of ComponentRegistry) {
        expect(InterpreterSystem).toContain(name)
      }
    })
  })

  describe('InteractivePatterns', () => {
    it('should detect numbered lists', () => {
      const text = '1. Option one\n2. Option two'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(true)
    })

    it('should detect bulleted lists', () => {
      const text = '- First choice\n- Second choice'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(true)
    })

    it('should detect cursor markers', () => {
      const text = '❯ Dark mode'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(true)
    })

    it('should detect confirmation prompts', () => {
      const text = 'Continue? (y/n)'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(true)
    })

    it('should detect action prompts', () => {
      const text = 'Allow Edit to src/index.ts?'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(true)
    })

    it('should NOT match plain prose', () => {
      const text = 'This is just a paragraph of text with no interactive elements.'
      expect(InteractivePatterns.some(p => p.test(text))).toBe(false)
    })
  })

  describe('ComponentRegistry', () => {
    it('should contain v1 components', () => {
      expect(ComponentRegistry).toContain('Select')
      expect(ComponentRegistry).toContain('Confirm')
      expect(ComponentRegistry).toContain('TextInput')
      expect(ComponentRegistry).toContain('Alert')
      expect(ComponentRegistry).toContain('ProgressBar')
    })
  })

  describe('AllowedHtmlElements', () => {
    it('should contain standard HTML elements', () => {
      expect(AllowedHtmlElements).toContain('div')
      expect(AllowedHtmlElements).toContain('p')
      expect(AllowedHtmlElements).toContain('span')
      expect(AllowedHtmlElements).toContain('strong')
    })
  })

  describe('Event type classification', () => {
    it('should have non-overlapping bypass and buffered sets', () => {
      for (const t of BypassEventTypes) {
        expect(BufferedEventTypes).not.toContain(t)
      }
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/domain && pnpm test -- src/constants/gui.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create GUI constants**

Create `repos/domain/src/constants/gui.ts`:

```typescript
export const ComponentRegistry = [
  'Select',
  'Confirm',
  'TextInput',
  'Alert',
  'ProgressBar',
] as const

export const AllowedHtmlElements = [
  'div', 'p', 'span', 'strong', 'em',
  'ul', 'li', 'ol', 'code', 'pre', 'hr', 'br',
] as const

export const BypassEventTypes = [
  'activity',
  'prompt-ready',
  'input',
] as const

export const BufferedEventTypes = [
  'text',
  'tool-call',
  'permission',
  'diff',
  'error',
  'unknown',
] as const

export const InteractivePatterns = [
  /^\s*\d+[.)]\s+/m,
  /^\s*[-*]\s+/m,
  /[❯›>→]\s+/m,
  /\(y\/n\)|\[Y\/n\]|\(yes\/no\)/i,
  /\b(Allow|Do you want to|Choose|Select|Pick)\b/i,
]

export const InterpreterSystem = `You are a UI interpreter. Convert raw CLI text output into a React createElement-compatible JSON tree.

OUTPUT FORMAT (strict JSON, no markdown fences, no explanation):
Return a single JSON object matching this TypeScript type:
{
  "type": "div",
  "props": null,
  "children": [ ... ]
}

If the content is plain prose with no interactive elements, return the string: null

AVAILABLE CUSTOM COMPONENTS:

1. Select
   props: { "options": [{ "label": "string", "value": "string", "description": "optional string" }], "interactionType": "ArrowSelect" | "NumberSelect", "currentIndex": number }
   Use for any list of choices the user should pick from.
   - Use "ArrowSelect" when the terminal shows a cursor marker (❯, >, →, *) indicating arrow-key navigation. Set "currentIndex" to the 0-based position of the marked option.
   - Use "NumberSelect" when the terminal shows a numbered list (1., 2., etc.).
   - The "value" field should be the display text of the option.
   - Must have at least 2 options.

2. Confirm
   props: { "prompt": "string", "yesLabel": "optional string", "noLabel": "optional string" }
   Use for yes/no, y/n, approve/deny binary choices.

3. TextInput
   props: { "placeholder": "optional string", "label": "optional string" }
   Use when the process is waiting for free-form text input.

4. Alert
   props: { "variant": "info" | "warning" | "success" | "error", "title": "optional string" }
   Use for callouts, warnings, tips, error messages.

5. ProgressBar
   props: { "value": number, "max": number, "label": "optional string" }
   Use for progress indicators, download bars, build progress.

STANDARD HTML ELEMENTS: div, p, span, strong, em, ul, li, ol, code, pre, hr, br

RULES:
- Always wrap output in a root "div".
- Detect numbered option lists and convert to Select with interactionType "NumberSelect".
- Detect cursor-marked lists (❯, >, →) and convert to Select with interactionType "ArrowSelect".
- Detect y/n or yes/no prompts and convert to Confirm.
- Use "p" for paragraphs of text.
- Do NOT include className or style props.
- children is always an array. Strings and objects are valid children.
- Respond with ONLY valid JSON or the string null. Nothing else.
- When unsure whether something is interactive, return null. False negatives are better than broken interactions.

EXAMPLES:

Input:
\`\`\`
? Select a theme:
  ❯ Dark mode
    Light mode
    System
\`\`\`

Output:
{"type":"div","props":null,"children":[{"type":"p","props":null,"children":["Select a theme:"]},{"type":"Select","props":{"interactionType":"ArrowSelect","currentIndex":0,"options":[{"label":"Dark mode","value":"Dark mode"},{"label":"Light mode","value":"Light mode"},{"label":"System","value":"System"}]},"children":[]}]}

Input:
\`\`\`
Allow Edit to src/App.tsx? (y/n)
\`\`\`

Output:
{"type":"div","props":null,"children":[{"type":"Confirm","props":{"prompt":"Allow Edit to src/App.tsx?","yesLabel":"Allow","noLabel":"Deny"},"children":[]}]}

Input:
\`\`\`
The function has been updated successfully. The changes include improved error handling and a new retry mechanism.
\`\`\`

Output:
null`
```

- [ ] **Step 4: Export from constants barrel**

Add to `repos/domain/src/constants/index.ts`:

```typescript
export * from './gui.ts'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd repos/domain && pnpm test -- src/constants/gui.test.ts`
Expected: PASS

---

### Task 3: Event Framing Types

**Files:**
- Create: `repos/domain/src/types/shellEvent.types.ts`
- Modify: `repos/domain/src/types/index.ts` (add export)

- [ ] **Step 1: Create shell event framing types**

Create `repos/domain/src/types/shellEvent.types.ts`:

```typescript
import type { TParsedEvent } from './parser.types.ts'
import type { TJsonComponentTree } from './gui.types.ts'

export type TShellEvent = {
  sessionId: string
  event: TParsedEvent
  chunkId?: string
  timestamp: number
}

export type TGenerativeUIEvent = {
  sessionId: string
  chunkId: string
  type: 'generative-ui'
  tree: TJsonComponentTree
  timestamp: number
}

export type TShellOutboundMessage = TShellEvent | TGenerativeUIEvent
```

- [ ] **Step 2: Export from types barrel**

Add to `repos/domain/src/types/index.ts`:

```typescript
export type * from './shellEvent.types.ts'
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: PASS

---

## Phase 2: Database

### Task 4: Add `config` Column to Organizations

**Files:**
- Modify: `repos/database/src/schemas/orgs.ts`

- [ ] **Step 1: Add config column to organizations schema**

In `repos/database/src/schemas/orgs.ts`, add a `config` jsonb column to the `orgs` table definition. The existing columns are `id`, `name`, `description`, `ownerId` plus base fields. Add after `ownerId`:

```typescript
config: jsonb('config').$type<TOrgConfig>(),
```

Import `TOrgConfig` from `@tdsk/domain` and `jsonb` from drizzle-orm/pg-core (verify the existing import pattern in the file).

- [ ] **Step 2: Verify types compile**

Run: `cd repos/database && pnpm types`
Expected: PASS

- [ ] **Step 3: Note for manual DB push**

The user must run `cd repos/database && pnpm push` manually to push the schema change to the database. This is interactive and cannot be automated.

---

## Phase 3: Backend — Interpreter Infrastructure

### Task 5: ChunkBuffer

**Files:**
- Create: `repos/backend/src/services/interpreter/chunkBuffer.ts`
- Test: `repos/backend/src/services/interpreter/chunkBuffer.test.ts`

- [ ] **Step 1: Write ChunkBuffer tests**

Create `repos/backend/src/services/interpreter/chunkBuffer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkBuffer } from './chunkBuffer.ts'
import type { TParsedEvent } from '@tdsk/domain'

function textEvent(content: string): TParsedEvent {
  return { type: 'text', content, timestamp: Date.now() }
}

function promptReadyEvent(): TParsedEvent {
  return { type: 'prompt-ready', timestamp: Date.now() }
}

function activityEvent(): TParsedEvent {
  return { type: 'activity', timestamp: Date.now() }
}

function inputEvent(content: string): TParsedEvent {
  return { type: 'input', content, userId: 'user1', timestamp: Date.now() }
}

describe('ChunkBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should assign chunkId to buffered events', () => {
    const stamped: { event: TParsedEvent; chunkId?: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (event, chunkId) => stamped.push({ event, chunkId }),
      onFlush: () => {},
    })

    buffer.push(textEvent('hello'))
    expect(stamped).toHaveLength(1)
    expect(stamped[0].chunkId).toBeDefined()
    expect(typeof stamped[0].chunkId).toBe('string')
  })

  it('should NOT assign chunkId to bypass events', () => {
    const stamped: { event: TParsedEvent; chunkId?: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (event, chunkId) => stamped.push({ event, chunkId }),
      onFlush: () => {},
    })

    buffer.push(activityEvent())
    buffer.push(inputEvent('test'))
    expect(stamped).toHaveLength(2)
    expect(stamped[0].chunkId).toBeUndefined()
    expect(stamped[1].chunkId).toBeUndefined()
  })

  it('should flush on prompt-ready event', () => {
    const flushed: { chunkId: string; events: TParsedEvent[] }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: (chunkId, events) => flushed.push({ chunkId, events }),
    })

    buffer.push(textEvent('line 1'))
    buffer.push(textEvent('line 2'))
    expect(flushed).toHaveLength(0)

    buffer.push(promptReadyEvent())
    expect(flushed).toHaveLength(1)
    expect(flushed[0].events).toHaveLength(2)
    expect(flushed[0].events[0].type).toBe('text')
  })

  it('should flush on debounce timeout', () => {
    const flushed: { chunkId: string; events: TParsedEvent[] }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: (chunkId, events) => flushed.push({ chunkId, events }),
    })

    buffer.push(textEvent('line 1'))
    expect(flushed).toHaveLength(0)

    vi.advanceTimersByTime(200)
    expect(flushed).toHaveLength(1)
    expect(flushed[0].events).toHaveLength(1)
  })

  it('should generate new chunkId after flush', () => {
    const stamped: { chunkId?: string }[] = []
    const flushed: { chunkId: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (_, chunkId) => stamped.push({ chunkId }),
      onFlush: (chunkId) => flushed.push({ chunkId }),
    })

    buffer.push(textEvent('chunk 1'))
    buffer.push(promptReadyEvent())
    buffer.push(textEvent('chunk 2'))

    expect(stamped[0].chunkId).toBe(flushed[0].chunkId)
    expect(stamped[1].chunkId).not.toBe(stamped[0].chunkId)
  })

  it('should not flush empty buffer', () => {
    const flushed: unknown[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: () => flushed.push(1),
    })

    buffer.push(promptReadyEvent())
    expect(flushed).toHaveLength(0)
  })

  it('should clean up timers on destroy', () => {
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: () => {},
    })

    buffer.push(textEvent('line'))
    buffer.destroy()
    vi.advanceTimersByTime(300)
    // No error thrown, timer was cleared
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/chunkBuffer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ChunkBuffer**

Create `repos/backend/src/services/interpreter/chunkBuffer.ts`:

```typescript
import { createId } from '@paralleldrive/cuid2'
import { BypassEventTypes } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'

const DebounceMs = 200

type TChunkBufferCallbacks = {
  onStampedEvent: (event: TParsedEvent, chunkId?: string) => void
  onFlush: (chunkId: string, events: TParsedEvent[]) => void
}

export class ChunkBuffer {
  #currentChunkId: string = createId()
  #buffer: TParsedEvent[] = []
  #debounceTimer: ReturnType<typeof setTimeout> | null = null
  #callbacks: TChunkBufferCallbacks

  constructor(callbacks: TChunkBufferCallbacks) {
    this.#callbacks = callbacks
  }

  push(event: TParsedEvent) {
    const isBypass = (BypassEventTypes as readonly string[]).includes(event.type)

    if (isBypass) {
      this.#callbacks.onStampedEvent(event, undefined)

      if (event.type === 'prompt-ready') {
        this.#flush()
      }
      return
    }

    this.#buffer.push(event)
    this.#callbacks.onStampedEvent(event, this.#currentChunkId)
    this.#resetDebounce()
  }

  destroy() {
    this.#clearDebounce()
  }

  #flush() {
    this.#clearDebounce()

    if (this.#buffer.length === 0) return

    const chunkId = this.#currentChunkId
    const events = [...this.#buffer]
    this.#buffer = []
    this.#currentChunkId = createId()

    this.#callbacks.onFlush(chunkId, events)
  }

  #resetDebounce() {
    this.#clearDebounce()
    this.#debounceTimer = setTimeout(() => this.#flush(), DebounceMs)
  }

  #clearDebounce() {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer)
      this.#debounceTimer = null
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/chunkBuffer.test.ts`
Expected: PASS

---

### Task 6: Skip Heuristic

**Files:**
- Create: `repos/backend/src/services/interpreter/skipHeuristic.ts`
- Test: `repos/backend/src/services/interpreter/skipHeuristic.test.ts`

- [ ] **Step 1: Write skip heuristic tests**

Create `repos/backend/src/services/interpreter/skipHeuristic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shouldInterpret } from './skipHeuristic.ts'
import type { TParsedEvent } from '@tdsk/domain'

function textEvent(content: string): TParsedEvent {
  return { type: 'text', content, timestamp: Date.now() }
}

function unknownEvent(raw: string): TParsedEvent {
  return { type: 'unknown', raw, timestamp: Date.now() }
}

function toolCallEvent(): TParsedEvent {
  return { type: 'tool-call', tool: 'Read', target: 'src/index.ts', status: 'running', timestamp: Date.now() }
}

describe('shouldInterpret', () => {
  it('should return true for numbered list', () => {
    const events = [textEvent('Choose an option:'), textEvent('1. Redis'), textEvent('2. PostgreSQL')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for bulleted list', () => {
    const events = [textEvent('- Option A'), textEvent('- Option B')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for cursor markers', () => {
    const events = [unknownEvent('❯ Dark mode'), unknownEvent('  Light mode')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for y/n prompt', () => {
    const events = [textEvent('Continue? (y/n)')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for action prompts', () => {
    const events = [textEvent('Allow Edit to src/App.tsx?')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return false for plain prose', () => {
    const events = [textEvent('The function has been updated successfully.')]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should return false for empty events', () => {
    expect(shouldInterpret([])).toBe(false)
  })

  it('should return false for whitespace-only content', () => {
    const events = [textEvent('   '), textEvent('\n')]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should ignore non-text event types in pattern matching', () => {
    const events = [toolCallEvent()]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should return true when mixed events contain interactive text', () => {
    const events = [toolCallEvent(), textEvent('Choose: 1. Yes 2. No')]
    expect(shouldInterpret(events)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/skipHeuristic.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement skip heuristic**

Create `repos/backend/src/services/interpreter/skipHeuristic.ts`:

```typescript
import { InteractivePatterns } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'

export function shouldInterpret(events: TParsedEvent[]): boolean {
  const text = events
    .filter((e): e is Extract<TParsedEvent, { type: 'text' }> | Extract<TParsedEvent, { type: 'unknown' }> =>
      e.type === 'text' || e.type === 'unknown'
    )
    .map(e => ('content' in e ? e.content : 'raw' in e ? e.raw : ''))
    .join('\n')

  if (!text.trim()) return false

  return InteractivePatterns.some(pattern => pattern.test(text))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/skipHeuristic.test.ts`
Expected: PASS

---

### Task 7: JSON Tree Validator

**Files:**
- Create: `repos/backend/src/services/interpreter/validator.ts`
- Test: `repos/backend/src/services/interpreter/validator.test.ts`

- [ ] **Step 1: Write validator tests**

Create `repos/backend/src/services/interpreter/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateTree } from './validator.ts'

describe('validateTree', () => {
  it('should accept a valid tree with Select', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'ArrowSelect',
            currentIndex: 0,
            options: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
            ],
          },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept a valid tree with Confirm', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        { type: 'Confirm', props: { prompt: 'Continue?' }, children: [] },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should accept HTML-only trees', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        { type: 'p', props: null, children: ['Hello world'] },
      ],
    }
    expect(validateTree(tree)).toBe(true)
  })

  it('should reject non-div root', () => {
    const tree = { type: 'span', props: null, children: [] }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject unknown component types', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [{ type: 'FancyWidget', props: {}, children: [] }],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject Select with fewer than 2 options', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: { interactionType: 'NumberSelect', options: [{ label: 'A', value: 'A' }] },
          children: [],
        },
      ],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject Confirm with empty prompt', () => {
    const tree = {
      type: 'div',
      props: null,
      children: [
        { type: 'Confirm', props: { prompt: '' }, children: [] },
      ],
    }
    expect(validateTree(tree)).toBe(false)
  })

  it('should reject trees exceeding max depth', () => {
    let node: any = { type: 'span', props: null, children: ['leaf'] }
    for (let i = 0; i < 12; i++) {
      node = { type: 'div', props: null, children: [node] }
    }
    expect(validateTree(node)).toBe(false)
  })

  it('should accept string children', () => {
    const tree = {
      type: 'div',
      props: null,
      children: ['Hello', { type: 'strong', props: null, children: ['world'] }],
    }
    expect(validateTree(tree)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/validator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validator**

Create `repos/backend/src/services/interpreter/validator.ts`:

```typescript
import { ComponentRegistry, AllowedHtmlElements } from '@tdsk/domain'
import type { TJsonComponentNode } from '@tdsk/domain'

const MaxDepth = 10

const registrySet = new Set<string>(ComponentRegistry)
const htmlSet = new Set<string>(AllowedHtmlElements)

export function validateTree(tree: unknown): tree is TJsonComponentNode {
  if (!isNode(tree)) return false
  if (tree.type !== 'div') return false
  return validateNode(tree, 0)
}

function isNode(val: unknown): val is TJsonComponentNode {
  return (
    typeof val === 'object'
    && val !== null
    && 'type' in val
    && typeof (val as any).type === 'string'
  )
}

function validateNode(node: TJsonComponentNode, depth: number): boolean {
  if (depth > MaxDepth) return false

  const { type, props, children } = node

  if (!registrySet.has(type) && !htmlSet.has(type)) return false

  if (registrySet.has(type) && !validateComponentProps(type, props)) return false

  if (children) {
    if (!Array.isArray(children)) return false
    for (const child of children) {
      if (typeof child === 'string') continue
      if (!isNode(child)) return false
      if (!validateNode(child, depth + 1)) return false
    }
  }

  return true
}

function validateComponentProps(type: string, props: unknown): boolean {
  if (!props || typeof props !== 'object') return false
  const p = props as Record<string, unknown>

  switch (type) {
    case 'Select': {
      const options = p.options
      if (!Array.isArray(options) || options.length < 2) return false
      return true
    }
    case 'Confirm': {
      if (typeof p.prompt !== 'string' || !p.prompt.trim()) return false
      return true
    }
    case 'TextInput':
    case 'Alert':
    case 'ProgressBar':
      return true
    default:
      return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/validator.test.ts`
Expected: PASS

---

### Task 8: Interpreter Service

**Files:**
- Create: `repos/backend/src/services/interpreter/interpreter.ts`
- Create: `repos/backend/src/services/interpreter/prompt.ts`
- Create: `repos/backend/src/services/interpreter/index.ts`
- Test: `repos/backend/src/services/interpreter/interpreter.test.ts`

- [ ] **Step 1: Create prompt builder**

Create `repos/backend/src/services/interpreter/prompt.ts`:

```typescript
import { InterpreterSystem } from '@tdsk/domain'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

export function getSystemPrompt(config: TGuiConfig): string {
  return config.systemPrompt?.trim() || InterpreterSystem
}

export function buildUserMessage(events: TParsedEvent[]): string {
  return events
    .map(e => {
      if (e.type === 'text') return e.content
      if (e.type === 'unknown') return e.raw
      if (e.type === 'error') return `Error: ${e.message}`
      if (e.type === 'tool-call') return `⏺ ${e.tool} ${e.target}`
      if (e.type === 'permission') return e.prompt
      if (e.type === 'diff') {
        const lines = [
          ...e.additions.map(l => `+ ${l}`),
          ...e.removals.map(l => `- ${l}`),
        ]
        return lines.join('\n')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}
```

- [ ] **Step 2: Write interpreter service tests**

Create `repos/backend/src/services/interpreter/interpreter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { InterpreterService } from './interpreter.ts'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({
    id: 'test-model',
    name: 'Test',
    api: 'openai-completions',
    provider: 'openai',
  })),
  streamSimple: vi.fn(),
}))

const { streamSimple } = await import('@mariozechner/pi-ai')

function mockStream(text: string) {
  return (async function* () {
    yield { type: 'text_delta' as const, delta: text }
    yield { type: 'done' as const, stopReason: 'stop' as const }
  })()
}

const testConfig: TGuiConfig = {
  enabled: true,
  providerId: 'prov-1',
  model: 'test-model',
  maxRetries: 1,
}

describe('InterpreterService', () => {
  it('should return parsed tree for valid JSON response', async () => {
    const tree = JSON.stringify({
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'NumberSelect',
            options: [
              { label: 'Redis', value: 'Redis' },
              { label: 'PostgreSQL', value: 'PostgreSQL' },
            ],
          },
          children: [],
        },
      ],
    })
    vi.mocked(streamSimple).mockResolvedValue(mockStream(tree))

    const service = new InterpreterService()
    const result = await service.interpret(
      { chunkId: 'chunk-1', events: [{ type: 'text', content: '1. Redis\n2. PostgreSQL', timestamp: Date.now() }] },
      testConfig,
      'anthropic',
      'sk-test-key',
    )

    expect(result).not.toBeNull()
    expect(result!.tree.type).toBe('div')
  })

  it('should return null when interpreter returns null string', async () => {
    vi.mocked(streamSimple).mockResolvedValue(mockStream('null'))

    const service = new InterpreterService()
    const result = await service.interpret(
      { chunkId: 'chunk-1', events: [{ type: 'text', content: 'Just plain text.', timestamp: Date.now() }] },
      testConfig,
      'anthropic',
      'sk-test-key',
    )

    expect(result).toBeNull()
  })

  it('should return null after exhausting retries on invalid JSON', async () => {
    vi.mocked(streamSimple).mockResolvedValue(mockStream('not valid json'))

    const service = new InterpreterService()
    const result = await service.interpret(
      { chunkId: 'chunk-1', events: [{ type: 'text', content: '1. A\n2. B', timestamp: Date.now() }] },
      { ...testConfig, maxRetries: 0 },
      'anthropic',
      'sk-test-key',
    )

    expect(result).toBeNull()
  })

  it('should strip markdown fences from response', async () => {
    const tree = JSON.stringify({ type: 'div', props: null, children: ['hello'] })
    const wrapped = '```json\n' + tree + '\n```'
    vi.mocked(streamSimple).mockResolvedValue(mockStream(wrapped))

    const service = new InterpreterService()
    const result = await service.interpret(
      { chunkId: 'chunk-1', events: [{ type: 'text', content: '1. A\n2. B', timestamp: Date.now() }] },
      testConfig,
      'anthropic',
      'sk-test-key',
    )

    expect(result).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/interpreter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement interpreter service**

Create `repos/backend/src/services/interpreter/interpreter.ts`:

```typescript
import { getModel, streamSimple } from '@mariozechner/pi-ai'
import type { TGuiConfig, TParsedEvent, TGenerativeUIResult } from '@tdsk/domain'
import { validateTree } from './validator.ts'
import { getSystemPrompt, buildUserMessage } from './prompt.ts'

export class InterpreterService {
  async interpret(
    chunk: { chunkId: string; events: TParsedEvent[] },
    config: TGuiConfig,
    providerBrand: string,
    apiKey: string,
  ): Promise<TGenerativeUIResult | null> {
    const userMessage = buildUserMessage(chunk.events)
    if (!userMessage.trim()) return null

    const systemPrompt = getSystemPrompt(config)
    let lastError: Error | null = null
    const maxAttempts = 1 + config.maxRetries

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const text = await this.#callLLM(providerBrand, config.model, apiKey, systemPrompt, userMessage)
        return this.#parseResponse(text)
      }
      catch (err) {
        lastError = err as Error
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }

    console.warn(`[InterpreterService] Failed after ${maxAttempts} attempts:`, lastError?.message)
    return null
  }

  async #callLLM(
    providerBrand: string,
    modelId: string,
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const model = getModel(providerBrand as any, modelId as any)
    if (!model) {
      throw new Error(`Model not found: ${providerBrand}/${modelId}`)
    }

    const stream = await streamSimple(
      { ...model, apiKey } as any,
      {
        systemPrompt,
        messages: [{ role: 'user' as const, content: userMessage, timestamp: Date.now() }],
      },
      { maxTokens: 2048, temperature: 0 },
    )

    let response = ''
    for await (const event of stream) {
      if (event.type === 'text_delta') response += event.delta
      if (event.type === 'error') throw new Error(event.error)
    }

    return response
  }

  #parseResponse(text: string): TGenerativeUIResult | null {
    const cleaned = text.replace(/```json\s*|```\s*/g, '').trim()

    if (cleaned === 'null') return null

    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object' || !parsed.type) {
      throw new Error('Response missing required type field')
    }

    if (!validateTree(parsed)) {
      throw new Error('Response failed tree validation')
    }

    return { tree: parsed }
  }
}
```

- [ ] **Step 5: Create barrel export**

Create `repos/backend/src/services/interpreter/index.ts`:

```typescript
export { ChunkBuffer } from './chunkBuffer.ts'
export { InterpreterService } from './interpreter.ts'
export { shouldInterpret } from './skipHeuristic.ts'
export { validateTree } from './validator.ts'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- src/services/interpreter/interpreter.test.ts`
Expected: PASS

---

### Task 9: Wire Interpreter into onShellConnect

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

This task modifies the existing shell handler to integrate the ChunkBuffer and InterpreterService. The changes are scoped to:
1. The `broadcastEvent` function (lines 44-51) — add chunkId and timestamp to the outbound message
2. The `onEvent` callback area (lines 540-578) — route events through ChunkBuffer instead of directly broadcasting
3. Session initialization — resolve guiConfig, instantiate ChunkBuffer and InterpreterService

- [ ] **Step 1: Update broadcastEvent to accept framing fields**

In `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`, modify the `broadcastEvent` function at lines 44-51 to accept optional `chunkId` and `timestamp`:

```typescript
function broadcastEvent(
  session: TShellSession,
  sessionId: string,
  event: TParsedEvent,
  chunkId?: string,
  timestamp?: number,
) {
  const msg = JSON.stringify({ sessionId, event, chunkId, timestamp: timestamp ?? Date.now() })
  for (const client of session.attachments) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}
```

- [ ] **Step 2: Add a broadcastUpgrade helper**

Add below `broadcastEvent`:

```typescript
function broadcastUpgrade(
  session: TShellSession,
  sessionId: string,
  chunkId: string,
  tree: TJsonComponentTree,
  timestamp: number,
) {
  const msg = JSON.stringify({
    sessionId,
    chunkId,
    type: 'generative-ui' as const,
    tree,
    timestamp,
  })
  for (const client of session.attachments) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}
```

Add the necessary imports at the top of the file:

```typescript
import { ChunkBuffer, InterpreterService, shouldInterpret } from '../../services/interpreter/index.ts'
import type { TGuiConfig, TJsonComponentTree } from '@tdsk/domain'
```

- [ ] **Step 3: Resolve guiConfig during session initialization**

In the session setup area (after the sandbox and org are loaded, before the SSH connection is established), add config resolution:

```typescript
const guiConfig = sandbox.projectConfig?.guiConfig ?? org.config?.guiConfig ?? null
const guiEnabled = guiConfig?.enabled === true
```

The exact location depends on where `sandbox` and `org` are available in the handler. Place it after both are loaded.

- [ ] **Step 4: Instantiate ChunkBuffer and InterpreterService when GUI is enabled**

After guiConfig resolution:

```typescript
let chunkBuffer: ChunkBuffer | null = null
const interpreterService = new InterpreterService()

if (guiEnabled && guiConfig) {
  chunkBuffer = new ChunkBuffer({
    onStampedEvent: (event, chunkId) => {
      broadcastEvent(session, sessionId, event, chunkId, event.timestamp)
      sbService.queueEventForPersistence(sessionId, event)
    },
    onFlush: async (chunkId, events) => {
      if (!shouldInterpret(events)) return

      try {
        const provider = await resolveProvider(guiConfig.providerId, org.id)
        if (!provider) return

        const result = await interpreterService.interpret(
          { chunkId, events },
          guiConfig,
          provider.brand,
          provider.apiKey,
        )

        if (result) {
          const timestamp = events[0]?.timestamp ?? Date.now()
          broadcastUpgrade(session, sessionId, chunkId, result.tree, timestamp)
          sbService.queueEventForPersistence(sessionId, {
            type: 'generative-ui' as any,
            chunkId,
            tree: result.tree,
            timestamp,
          } as any)
        }
      }
      catch (err) {
        console.warn(`[GenerativeUI] Interpretation failed for chunk ${chunkId}:`, err)
      }
    },
  })
}
```

Note: `resolveProvider` is a helper that loads the provider record and decrypts its API key. Use the existing provider/secret resolution pattern from the backend services. The exact implementation depends on how providers are loaded in the current codebase — check `repos/backend/src/services/providers/` for the pattern.

- [ ] **Step 5: Route events through ChunkBuffer in the onEvent callback**

Replace the direct `broadcastEvent` and `queueEventForPersistence` calls in the onEvent callback (around lines 569-578) with:

```typescript
if (chunkBuffer) {
  chunkBuffer.push(event)
}
else {
  broadcastEvent(session, sessionId, event, undefined, event.timestamp)
  sbService.queueEventForPersistence(sessionId, event)
}
```

The tool-call tracking and deriveToolState logic above this (lines 545-574) stays unchanged.

- [ ] **Step 6: Clean up ChunkBuffer on session close**

In the session cleanup/detach area, add:

```typescript
chunkBuffer?.destroy()
```

- [ ] **Step 7: Verify build**

Run: `cd repos/backend && pnpm build`
Expected: PASS — no build errors

---

## Phase 4: Backend — Config Endpoints

### Task 10: Update Org Endpoint for guiConfig

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/updateOrg.ts`

- [ ] **Step 1: Accept config field in update**

In `repos/backend/src/endpoints/orgs/updateOrg.ts`, the existing handler calls `db.services.org.update()` with the request body fields. Add `config` to the accepted fields:

```typescript
const { name, description, config } = req.body
const data: Record<string, unknown> = {}
if (name !== undefined) data.name = name
if (description !== undefined) data.description = description
if (config !== undefined) data.config = config

const [updated] = await db.services.org.update(orgId, data)
```

The exact modification depends on the current structure of the handler. The key change is accepting `config` from the body and passing it through to the update call.

- [ ] **Step 2: Verify build**

Run: `cd repos/backend && pnpm build`
Expected: PASS

---

### Task 11: Update Sandbox Project Config for guiConfig

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxProjectConfig.ts`

- [ ] **Step 1: Ensure guiConfig is accepted in the config JSONB**

The sandbox project config endpoint already accepts a `config` JSONB field. Since `guiConfig` is a new property within that JSONB, no code change is needed if the endpoint passes through the config object as-is. Verify this by reading the current endpoint.

If the endpoint validates or whitelists specific config keys, add `guiConfig` to the allowed keys.

- [ ] **Step 2: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

## Phase 5: Admin UI

### Task 12: GuiConfig Section in OrgSettings

**Files:**
- Create: `repos/admin/src/components/GuiConfig/GuiConfigForm.tsx`
- Modify: `repos/admin/src/pages/Orgs/OrgSettings.tsx`

- [ ] **Step 1: Create GuiConfigForm component**

Create `repos/admin/src/components/GuiConfig/GuiConfigForm.tsx`:

```tsx
import { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Switch,
  FormControlLabel,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { TGuiConfig } from '@tdsk/domain'

// These components should be imported from the existing admin codebase.
// Adjust import paths based on actual file locations:
// - ProviderSelect: dropdown for org providers
// - ModelAutocomplete: model selection filtered by provider
// - MonacoEditor: Monaco editor for system prompt

type TGuiConfigFormProps = {
  config: TGuiConfig | undefined
  orgProviders: { id: string; name: string; brand: string }[]
  disabled?: boolean
  onChange: (config: TGuiConfig | undefined) => void
}

const DefaultConfig: TGuiConfig = {
  enabled: false,
  providerId: '',
  model: '',
  maxRetries: 2,
}

export function GuiConfigForm({ config, orgProviders, disabled, onChange }: TGuiConfigFormProps) {
  const current = config ?? DefaultConfig
  const [promptOpen, setPromptOpen] = useState(false)

  const update = useCallback(
    (partial: Partial<TGuiConfig>) => {
      onChange({ ...current, ...partial })
    },
    [current, onChange],
  )

  const selectedProvider = useMemo(
    () => orgProviders.find(p => p.id === current.providerId),
    [orgProviders, current.providerId],
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={current.enabled}
            onChange={(_, checked) => update({ enabled: checked })}
            disabled={disabled}
          />
        }
        label="Enable Generative UI"
      />

      <TextField
        select
        label="AI Provider"
        value={current.providerId}
        onChange={e => update({ providerId: e.target.value })}
        disabled={disabled || !current.enabled}
        SelectProps={{ native: true }}
        size="small"
      >
        <option value="">Select a provider...</option>
        {orgProviders.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.brand})
          </option>
        ))}
      </TextField>

      {/* Replace with ModelAutocomplete component from existing admin codebase */}
      <TextField
        label="Model"
        value={current.model}
        onChange={e => update({ model: e.target.value })}
        disabled={disabled || !current.enabled}
        placeholder="e.g., claude-haiku-4-5-20251001"
        size="small"
      />

      <TextField
        label="Max Retries"
        type="number"
        value={current.maxRetries}
        onChange={e => update({ maxRetries: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
        disabled={disabled || !current.enabled}
        inputProps={{ min: 0, max: 5 }}
        size="small"
      />

      <Accordion
        expanded={promptOpen}
        onChange={(_, open) => setPromptOpen(open)}
        disabled={disabled || !current.enabled}
        disableGutters
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Custom System Prompt (optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Replace with Monaco editor from existing admin codebase */}
          <TextField
            multiline
            rows={8}
            fullWidth
            value={current.systemPrompt ?? ''}
            onChange={e => update({ systemPrompt: e.target.value || undefined })}
            placeholder="Leave empty to use the default interpreter prompt"
            size="small"
            sx={{ fontFamily: 'monospace' }}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
```

Note: The `TextField` for model should be replaced with the existing `ModelAutocomplete` component from the admin codebase, and the multiline `TextField` for system prompt should be replaced with the Monaco editor component. The exact import paths depend on the admin codebase structure — check `repos/admin/src/components/` for these components.

- [ ] **Step 2: Add GuiConfig section to OrgSettings**

In `repos/admin/src/pages/Orgs/OrgSettings.tsx`, add a new `SettingsFormCard` section after the existing name/description card. Import `GuiConfigForm` and wire it to the org's `config.guiConfig`:

```tsx
import { GuiConfigForm } from '@TAF/components/GuiConfig/GuiConfigForm'

// Inside the OrgSettings component, after the existing SettingsFormCard:
<SettingsFormCard
  title="Generative UI"
  description="Configure AI-powered interactive UI for sandbox terminal output"
  onSave={() => updateOrg(orgId, { config: { ...org.config, guiConfig: localGuiConfig } })}
  dirty={guiConfigDirty}
>
  <GuiConfigForm
    config={localGuiConfig}
    orgProviders={orgProviders}
    onChange={setLocalGuiConfig}
  />
</SettingsFormCard>
```

Add state for the local guiConfig:

```tsx
const [localGuiConfig, setLocalGuiConfig] = useState(org?.config?.guiConfig)
const guiConfigDirty = JSON.stringify(localGuiConfig) !== JSON.stringify(org?.config?.guiConfig)
```

- [ ] **Step 3: Verify build**

Run: `cd repos/admin && pnpm build`
Expected: PASS

---

### Task 13: GuiConfig Accordion in SandboxDrawer

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

- [ ] **Step 1: Add GuiConfig accordion section**

In `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`, add a new accordion section using the existing accordion pattern. Import `GuiConfigForm` and add state for the override toggle:

```tsx
import { GuiConfigForm } from '@TAF/components/GuiConfig/GuiConfigForm'

// Add state:
const [guiOverride, setGuiOverride] = useState(!!sandbox?.projectConfig?.guiConfig)
const [sandboxGuiConfig, setSandboxGuiConfig] = useState(sandbox?.projectConfig?.guiConfig)

// Add accordion section (after the existing Providers accordion):
<Accordion>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Typography>Generative UI</Typography>
  </AccordionSummary>
  <AccordionDetails>
    <FormControlLabel
      control={
        <Switch
          checked={guiOverride}
          onChange={(_, checked) => {
            setGuiOverride(checked)
            if (!checked) setSandboxGuiConfig(undefined)
          }}
        />
      }
      label="Override org default"
    />
    <GuiConfigForm
      config={guiOverride ? sandboxGuiConfig : orgGuiConfig}
      orgProviders={orgProviders}
      disabled={!guiOverride}
      onChange={setSandboxGuiConfig}
    />
  </AccordionDetails>
</Accordion>
```

Include `guiConfig: guiOverride ? sandboxGuiConfig : undefined` in the config object passed to the save handler.

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`
Expected: PASS

---

## Phase 6: Threads Frontend

### Task 14: Session Upgrades State

**Files:**
- Modify: `repos/threads/src/state/sessions.ts`
- Modify: `repos/threads/src/state/accessors.ts`
- Modify: `repos/threads/src/state/selectors.ts`

- [ ] **Step 1: Add sessionUpgradesAtom**

In `repos/threads/src/state/sessions.ts`, add:

```typescript
import type { TJsonComponentTree } from '@tdsk/domain'

export const sessionUpgradesAtom = atom<Map<string, Map<string, TJsonComponentTree>>>(new Map())
```

- [ ] **Step 2: Add upgrade accessors**

In `repos/threads/src/state/accessors.ts`, add:

```typescript
import { sessionUpgradesAtom } from './sessions.ts'
import type { TJsonComponentTree } from '@tdsk/domain'

export function setSessionUpgrade(sessionId: string, chunkId: string, tree: TJsonComponentTree) {
  const current = store.get(sessionUpgradesAtom)
  const sessionMap = current.get(sessionId) ?? new Map()
  sessionMap.set(chunkId, tree)
  const next = new Map(current)
  next.set(sessionId, sessionMap)
  store.set(sessionUpgradesAtom, next)
}

export function getSessionUpgrades(sessionId: string): Map<string, TJsonComponentTree> {
  return store.get(sessionUpgradesAtom).get(sessionId) ?? new Map()
}
```

- [ ] **Step 3: Add upgrade selector hook**

In `repos/threads/src/state/selectors.ts`, add:

```typescript
import { sessionUpgradesAtom } from './sessions.ts'

export function useSessionUpgrades(sessionId: string): Map<string, TJsonComponentTree> {
  const all = useAtomValue(sessionUpgradesAtom)
  return all.get(sessionId) ?? EmptyUpgradesMap
}

const EmptyUpgradesMap = new Map<string, TJsonComponentTree>()
```

- [ ] **Step 4: Verify types compile**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 15: Handle Upgrade Events in openSession

**Files:**
- Modify: `repos/threads/src/actions/sessions/openSession.ts`

- [ ] **Step 1: Add upgrade event handling in onmessage**

In `repos/threads/src/actions/sessions/openSession.ts`, inside the `onmessage` handler (around lines 148-162), add a check for generative-ui messages before the existing event handling:

```typescript
// After JSON parsing, before existing event handling:
if (msg.type === 'generative-ui' && msg.chunkId && msg.tree) {
  setSessionUpgrade(msg.sessionId, msg.chunkId, msg.tree)
  return
}
```

Import `setSessionUpgrade` from the accessors:

```typescript
import { setSessionUpgrade } from '../state/accessors.ts'
```

The existing event handling (`msg.sessionId && msg.event`) continues to work unchanged — raw events with chunkId are appended to sessionEventsAtom as before. The chunkId is now part of the event framing and passes through transparently.

- [ ] **Step 2: Verify types compile**

Run: `cd repos/threads && pnpm types`
Expected: PASS

---

### Task 16: Stdin Translation Utility

**Files:**
- Create: `repos/threads/src/utils/stdinTranslation.ts`
- Test: `repos/threads/src/utils/stdinTranslation.test.ts`

- [ ] **Step 1: Write stdin translation tests**

Create `repos/threads/src/utils/stdinTranslation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { translateInteraction } from './stdinTranslation.ts'

describe('translateInteraction', () => {
  describe('ArrowSelect', () => {
    it('should send enter when selecting current index', () => {
      const result = translateInteraction('ArrowSelect', { selectedIndex: 0, currentIndex: 0 })
      expect(result).toBe('\r')
    })

    it('should send down arrows + enter when selecting below current', () => {
      const result = translateInteraction('ArrowSelect', { selectedIndex: 2, currentIndex: 0 })
      expect(result).toBe('\x1b[B\x1b[B\r')
    })

    it('should send up arrows + enter when selecting above current', () => {
      const result = translateInteraction('ArrowSelect', { selectedIndex: 0, currentIndex: 2 })
      expect(result).toBe('\x1b[A\x1b[A\r')
    })
  })

  describe('NumberSelect', () => {
    it('should send number + enter', () => {
      const result = translateInteraction('NumberSelect', { selectedIndex: 2 })
      expect(result).toBe('3\r')
    })

    it('should send 1 for first option', () => {
      const result = translateInteraction('NumberSelect', { selectedIndex: 0 })
      expect(result).toBe('1\r')
    })
  })

  describe('YesNo', () => {
    it('should send y for approve', () => {
      const result = translateInteraction('YesNo', { approved: true })
      expect(result).toBe('y\r')
    })

    it('should send n for deny', () => {
      const result = translateInteraction('YesNo', { approved: false })
      expect(result).toBe('n\r')
    })
  })

  describe('TextInput', () => {
    it('should send text + enter', () => {
      const result = translateInteraction('TextInput', { text: 'hello world' })
      expect(result).toBe('hello world\r')
    })
  })

  describe('Keystroke', () => {
    it('should send the key character', () => {
      const result = translateInteraction('Keystroke', { key: 'q' })
      expect(result).toBe('q')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/threads && pnpm test -- src/utils/stdinTranslation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement stdin translation**

Create `repos/threads/src/utils/stdinTranslation.ts`:

```typescript
type TArrowSelectParams = { selectedIndex: number; currentIndex: number }
type TNumberSelectParams = { selectedIndex: number }
type TYesNoParams = { approved: boolean }
type TTextInputParams = { text: string }
type TKeystrokeParams = { key: string }

type TInteractionParams =
  | TArrowSelectParams
  | TNumberSelectParams
  | TYesNoParams
  | TTextInputParams
  | TKeystrokeParams

const ArrowDown = '\x1b[B'
const ArrowUp = '\x1b[A'
const Enter = '\r'

export function translateInteraction(type: string, params: TInteractionParams): string {
  switch (type) {
    case 'ArrowSelect': {
      const { selectedIndex, currentIndex } = params as TArrowSelectParams
      const delta = selectedIndex - currentIndex
      if (delta === 0) return Enter
      const arrow = delta > 0 ? ArrowDown : ArrowUp
      return arrow.repeat(Math.abs(delta)) + Enter
    }
    case 'NumberSelect': {
      const { selectedIndex } = params as TNumberSelectParams
      return `${selectedIndex + 1}${Enter}`
    }
    case 'YesNo': {
      const { approved } = params as TYesNoParams
      return `${approved ? 'y' : 'n'}${Enter}`
    }
    case 'TextInput': {
      const { text } = params as TTextInputParams
      return `${text}${Enter}`
    }
    case 'Keystroke': {
      const { key } = params as TKeystrokeParams
      return key
    }
    default:
      return ''
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/threads && pnpm test -- src/utils/stdinTranslation.test.ts`
Expected: PASS

---

### Task 17: Component Registry (React components)

**Files:**
- Create: `repos/threads/src/components/ChatView/registry/GuiSelect.tsx`
- Create: `repos/threads/src/components/ChatView/registry/GuiConfirm.tsx`
- Create: `repos/threads/src/components/ChatView/registry/GuiTextInput.tsx`
- Create: `repos/threads/src/components/ChatView/registry/GuiAlert.tsx`
- Create: `repos/threads/src/components/ChatView/registry/GuiProgressBar.tsx`
- Create: `repos/threads/src/components/ChatView/registry/index.ts`

- [ ] **Step 1: Create GuiSelect component**

Create `repos/threads/src/components/ChatView/registry/GuiSelect.tsx`:

```tsx
import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'

type TOption = { label: string; value: string; description?: string }

type TGuiSelectProps = {
  options: TOption[]
  interactionType: 'ArrowSelect' | 'NumberSelect'
  currentIndex?: number
  onAction?: (type: string, params: Record<string, unknown>) => void
}

export function GuiSelect({ options, interactionType, currentIndex = 0, onAction }: TGuiSelectProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleClick = (index: number) => {
    if (selected !== null) return
    setSelected(index)
    onAction?.(interactionType, {
      selectedIndex: index,
      ...(interactionType === 'ArrowSelect' ? { currentIndex } : {}),
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1 }}>
      {options.map((opt, i) => (
        <Button
          key={i}
          variant="outlined"
          onClick={() => handleClick(i)}
          disabled={selected !== null}
          sx={{
            justifyContent: 'flex-start',
            textTransform: 'none',
            opacity: selected !== null && selected !== i ? 0.4 : 1,
            borderColor: selected === i ? 'primary.main' : 'divider',
            bgcolor: selected === i ? 'action.selected' : 'transparent',
          }}
        >
          <Box>
            <Typography variant="body2" fontWeight={500}>{opt.label}</Typography>
            {opt.description && (
              <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
            )}
          </Box>
        </Button>
      ))}
    </Box>
  )
}
```

- [ ] **Step 2: Create GuiConfirm component**

Create `repos/threads/src/components/ChatView/registry/GuiConfirm.tsx`:

```tsx
import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'

type TGuiConfirmProps = {
  prompt: string
  yesLabel?: string
  noLabel?: string
  onAction?: (type: string, params: Record<string, unknown>) => void
}

export function GuiConfirm({ prompt, yesLabel = 'Yes', noLabel = 'No', onAction }: TGuiConfirmProps) {
  const [decided, setDecided] = useState<boolean | null>(null)

  const handleClick = (approved: boolean) => {
    if (decided !== null) return
    setDecided(approved)
    onAction?.('YesNo', { approved })
  }

  return (
    <Box sx={{ my: 1 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>{prompt}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={() => handleClick(true)}
          disabled={decided !== null}
          sx={{ opacity: decided === false ? 0.4 : 1, textTransform: 'none' }}
        >
          {yesLabel}
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => handleClick(false)}
          disabled={decided !== null}
          sx={{ opacity: decided === true ? 0.4 : 1, textTransform: 'none' }}
        >
          {noLabel}
        </Button>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: Create GuiTextInput component**

Create `repos/threads/src/components/ChatView/registry/GuiTextInput.tsx`:

```tsx
import { useState } from 'react'
import { Box, TextField, IconButton } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

type TGuiTextInputProps = {
  placeholder?: string
  label?: string
  onAction?: (type: string, params: Record<string, unknown>) => void
}

export function GuiTextInput({ placeholder, label, onAction }: TGuiTextInputProps) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!value.trim() || submitted) return
    setSubmitted(true)
    onAction?.('TextInput', { text: value.trim() })
  }

  return (
    <Box sx={{ my: 1 }}>
      {label && <Box sx={{ mb: 0.5, fontSize: 13, color: 'text.secondary' }}>{label}</Box>}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          disabled={submitted}
        />
        <IconButton onClick={handleSubmit} disabled={!value.trim() || submitted} size="small">
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Create GuiAlert component**

Create `repos/threads/src/components/ChatView/registry/GuiAlert.tsx`:

```tsx
import { Alert as MuiAlert, AlertTitle } from '@mui/material'

type TGuiAlertProps = {
  variant?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children?: React.ReactNode
}

export function GuiAlert({ variant = 'info', title, children }: TGuiAlertProps) {
  return (
    <MuiAlert severity={variant} sx={{ my: 1 }}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </MuiAlert>
  )
}
```

- [ ] **Step 5: Create GuiProgressBar component**

Create `repos/threads/src/components/ChatView/registry/GuiProgressBar.tsx`:

```tsx
import { Box, LinearProgress, Typography } from '@mui/material'

type TGuiProgressBarProps = {
  value: number
  max?: number
  label?: string
}

export function GuiProgressBar({ value, max = 100, label }: TGuiProgressBarProps) {
  const percent = Math.min(100, (value / max) * 100)

  return (
    <Box sx={{ my: 1 }}>
      {label && <Typography variant="caption" color="text.secondary">{label}</Typography>}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress variant="determinate" value={percent} sx={{ flex: 1, height: 8, borderRadius: 4 }} />
        <Typography variant="caption" color="text.secondary">{Math.round(percent)}%</Typography>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 6: Create registry barrel**

Create `repos/threads/src/components/ChatView/registry/index.ts`:

```typescript
import { GuiSelect } from './GuiSelect.tsx'
import { GuiConfirm } from './GuiConfirm.tsx'
import { GuiTextInput } from './GuiTextInput.tsx'
import { GuiAlert } from './GuiAlert.tsx'
import { GuiProgressBar } from './GuiProgressBar.tsx'

export const GuiComponentRegistry: Record<string, React.ComponentType<any>> = {
  Select: GuiSelect,
  Confirm: GuiConfirm,
  TextInput: GuiTextInput,
  Alert: GuiAlert,
  ProgressBar: GuiProgressBar,
}
```

- [ ] **Step 7: Verify build**

Run: `cd repos/threads && pnpm build`
Expected: PASS

---

### Task 18: GenerativeUIRenderer

**Files:**
- Create: `repos/threads/src/components/ChatView/GenerativeUIRenderer.tsx`
- Test: `repos/threads/src/components/ChatView/GenerativeUIRenderer.test.tsx`

- [ ] **Step 1: Write renderer tests**

Create `repos/threads/src/components/ChatView/GenerativeUIRenderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenerativeUIRenderer } from './GenerativeUIRenderer.tsx'
import type { TJsonComponentTree } from '@tdsk/domain'

describe('GenerativeUIRenderer', () => {
  it('should render text children', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [{ type: 'p', props: null, children: ['Hello world'] }],
    }
    render(<GenerativeUIRenderer tree={tree} onAction={vi.fn()} />)
    expect(screen.getByText('Hello world')).toBeDefined()
  })

  it('should render Select component from registry', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'NumberSelect',
            options: [
              { label: 'Redis', value: 'Redis' },
              { label: 'PostgreSQL', value: 'PostgreSQL' },
            ],
          },
          children: [],
        },
      ],
    }
    render(<GenerativeUIRenderer tree={tree} onAction={vi.fn()} />)
    expect(screen.getByText('Redis')).toBeDefined()
    expect(screen.getByText('PostgreSQL')).toBeDefined()
  })

  it('should call onAction when interactive component is clicked', () => {
    const onAction = vi.fn()
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'Confirm',
          props: { prompt: 'Continue?' },
          children: [],
        },
      ],
    }
    render(<GenerativeUIRenderer tree={tree} onAction={onAction} />)
    fireEvent.click(screen.getByText('Yes'))
    expect(onAction).toHaveBeenCalledWith('YesNo', { approved: true })
  })

  it('should render nested HTML elements', () => {
    const tree: TJsonComponentTree = {
      type: 'div',
      props: null,
      children: [
        {
          type: 'p',
          props: null,
          children: [
            'This is ',
            { type: 'strong', props: null, children: ['bold'] },
            ' text',
          ],
        },
      ],
    }
    render(<GenerativeUIRenderer tree={tree} onAction={vi.fn()} />)
    expect(screen.getByText('bold')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/threads && pnpm test -- src/components/ChatView/GenerativeUIRenderer.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GenerativeUIRenderer**

Create `repos/threads/src/components/ChatView/GenerativeUIRenderer.tsx`:

```tsx
import React from 'react'
import { Box, Chip } from '@mui/material'
import { GuiComponentRegistry } from './registry/index.ts'
import type { TJsonComponentNode, TJsonComponentTree } from '@tdsk/domain'

type TRendererProps = {
  tree: TJsonComponentTree
  onAction: (type: string, params: Record<string, unknown>) => void
}

export function GenerativeUIRenderer({ tree, onAction }: TRendererProps) {
  return (
    <Box className="fade-swap" sx={{ fontSize: 14, lineHeight: 1.6 }}>
      {renderNode(tree, onAction, 'root')}
    </Box>
  )
}

function renderNode(
  node: TJsonComponentNode | string,
  onAction: (type: string, params: Record<string, unknown>) => void,
  key: string,
): React.ReactNode {
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object' || !node.type) return null

  const RegistryComponent = GuiComponentRegistry[node.type]

  if (RegistryComponent) {
    return (
      <RegistryComponent
        key={key}
        {...(node.props ?? {})}
        onAction={onAction}
      >
        {renderChildren(node.children, onAction, key)}
      </RegistryComponent>
    )
  }

  const children = renderChildren(node.children, onAction, key)
  return React.createElement(node.type, { key }, ...children)
}

function renderChildren(
  children: (TJsonComponentNode | string)[] | undefined,
  onAction: (type: string, params: Record<string, unknown>) => void,
  parentKey: string,
): React.ReactNode[] {
  if (!children) return []
  return children.map((child, i) => renderNode(child, onAction, `${parentKey}-${i}`))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/threads && pnpm test -- src/components/ChatView/GenerativeUIRenderer.test.tsx`
Expected: PASS

---

### Task 19: ChatView ChunkId Grouping and Upgrade Rendering

**Files:**
- Modify: `repos/threads/src/components/ChatView/ChatView.tsx`

- [ ] **Step 1: Add upgrade-aware rendering to ChatView**

In `repos/threads/src/components/ChatView/ChatView.tsx`, modify the `ChatView` component (lines 64-98) to:

1. Import the upgrade hook and renderer:

```typescript
import { useSessionUpgrades } from '../../state/selectors.ts'
import { GenerativeUIRenderer } from './GenerativeUIRenderer.tsx'
import { translateInteraction } from '../../utils/stdinTranslation.ts'
import { sendInput } from '../../actions/sessions/sendInput.ts'
```

2. Inside the component, get upgrades and create the action handler:

```typescript
const upgrades = useSessionUpgrades(sessionId)

const handleGuiAction = useCallback((type: string, params: Record<string, unknown>) => {
  const bytes = translateInteraction(type, params)
  if (bytes) sendInput(sessionId, bytes)
}, [sessionId])
```

3. Replace the flat event map with chunk-aware grouping. The rendering logic:

```tsx
function renderEvents(
  events: (TParsedEvent & { chunkId?: string; timestamp?: number })[],
  upgrades: Map<string, TJsonComponentTree>,
  handleGuiAction: (type: string, params: Record<string, unknown>) => void,
  sessionId: string,
) {
  const rendered: React.ReactNode[] = []
  const processedChunks = new Set<string>()

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const chunkId = event.chunkId

    // If this event has a chunkId and an upgrade exists, render the upgrade once
    if (chunkId && upgrades.has(chunkId)) {
      if (processedChunks.has(chunkId)) continue
      processedChunks.add(chunkId)
      rendered.push(
        <GenerativeUIRenderer
          key={`gui-${chunkId}`}
          tree={upgrades.get(chunkId)!}
          onAction={handleGuiAction}
        />
      )
      continue
    }

    // Otherwise render the raw event as before
    rendered.push(
      <EventRenderer key={`evt-${i}`} event={event} sessionId={sessionId} />
    )
  }

  return rendered
}
```

4. In the JSX, replace the existing `.map(EventRenderer)` with a call to `renderEvents`.

5. Add a "Show Raw" toggle for upgraded chunks — a small button that swaps between the component tree and the raw event rendering. Store toggle state locally per chunkId using `useState<Set<string>>`.

6. Add a CSS keyframe animation for the fade-swap transition when an upgrade replaces raw text:

```css
@keyframes fadeSwap {
  0% { opacity: 0.4; filter: blur(2px); }
  100% { opacity: 1; filter: blur(0); }
}
.fade-swap { animation: fadeSwap 0.35s ease-out forwards; }
```

- [ ] **Step 2: Verify build**

Run: `cd repos/threads && pnpm build`
Expected: PASS

---

## Phase 7: Verification

### Task 20: Full Build and Type Check

**Files:** None (verification only)

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: PASS — all repos type check clean

- [ ] **Step 2: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: PASS

- [ ] **Step 3: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

- [ ] **Step 4: Run threads tests**

Run: `cd repos/threads && pnpm test`
Expected: PASS

- [ ] **Step 5: Build all affected repos**

Run in order:
```bash
cd repos/domain && pnpm build
cd repos/backend && pnpm build
cd repos/admin && pnpm build
cd repos/threads && pnpm build
```
Expected: All PASS

---

## Notes

- **Database push required**: After Task 4, the user must manually run `cd repos/database && pnpm push` to push the organizations.config schema change.
- **Monaco editor**: Task 12 uses a multiline TextField as placeholder for the system prompt editor. During implementation, replace with the Monaco editor component used in other prompt fields in the admin codebase.
- **Model autocomplete**: Task 12 uses a basic TextField for model selection. During implementation, replace with the existing model autocomplete component filtered by provider.
- **Provider resolution**: Task 9 references a `resolveProvider` helper. This needs to load the provider record by ID, load its linked secret, and decrypt the API key. Follow the existing pattern in `repos/backend/src/services/providers/`.
- **Integration testing**: After all tasks are complete and K8s services are deployed, test end-to-end by opening a sandbox with a Claude Code runtime, enabling guiConfig on the org, and verifying that the theme picker renders as interactive buttons in the Threads chat view.
