# Bug: SmartInput stuck on "Working..." — tool state never transitions to `prompt`

## Problem

In the Threads SPA, the `SmartInput` component at the bottom of the chat view permanently shows "Working..." with a stop button, even when the terminal (visible in the Terminal tab) shows Claude Code is idle and ready for input. The tool state is stuck on `working` and never transitions to `prompt`.

## How to Reproduce

1. Start the threads app (`cd repos/threads && pnpm start`)
2. Connect to a running Claude Code sandbox session
3. Observe the chat tab — SmartInput shows "Working..." permanently
4. Switch to the Terminal tab — the terminal shows Claude Code is idle at a `❯` prompt
5. The SmartInput never updates to show the input field

## Architecture (How It Should Work)

The data flow for tool state is:

```
SSH stream → Backend parser (TerminalParser.write) 
  → GhosttyVT (WASM VT parser)
  → ChangeDetector (dirty-row tracking)
  → PatternMatcher (regex matching → TParsedEvent)
  → onEvent callback in onShellConnect.ts
  → broadcastEvent (JSON text frame over WebSocket)
  → Frontend openSession.ts ws.onmessage handler
  → deriveToolState(event) → setToolState(sessionId, state)
  → SmartInput reads useToolState(sessionId) and renders accordingly
```

For tool state to reach `prompt`, a `prompt-ready` event must be emitted by the parser and received by the frontend.

## Root Cause Analysis

The `prompt-ready` event is never emitted. There are two layers to why:

### Layer 1: ChangeDetector active-row problem

The `ChangeDetector` (`repos/domain/src/parser/changeDetector.ts`) only emits "sealed" lines to the pattern matcher — lines the cursor has moved past. A prompt line (like `❯ `) is where the cursor **stays** (waiting for input). It's never sealed, so it's never sent to the pattern matcher, so `prompt-ready` is never emitted.

A partial fix was attempted in this session: an `onActiveRow` callback was added so the active row's text is checked against matchers. However, **this fix did not work** — the issue persisted after the change. Possible reasons it didn't work:

- The active row text from `getLineText()` might not match the prompt regex (check what the WASM VT parser actually returns for the prompt line — it could include trailing spaces, shell decorations, or prompt text beyond just `❯`)
- The `onActiveRow` callback might not be firing (the condition `!sealedAny && dirtyRows.length > 0` combined with `activeText.length > 0` might not be met)
- The `tryMatch()` result might be returning `null` because the prompt regex doesn't match the actual terminal content

### Layer 2: Prompt regex may not match real Claude Code output

The prompt regex is `CCPromptPatternRegEx = /^[>$❯]\s*$/` in `repos/domain/src/constants/parser.ts`. This requires the ENTIRE line to be just a prompt character with optional whitespace. But Claude Code's prompt line may contain more:
- Hostname/path prefix: `sandbox@host:~$ ` 
- The `❯` character may be preceded by spaces or ANSI-stripped content
- The line from `getLineText()` may include the full shell prompt, not just the `❯`

## Debugging Strategy

### Step 1: See what the parser actually produces

Add temporary logging to `onShellConnect.ts` in the `onEvent` callback (around line 514) to log every event the parser emits:

```typescript
onEvent: (event) => {
  logger.debug(`[Shell][${sessionId}] parser event: ${event.type}`, 
    event.type === 'text' ? { content: event.content.slice(0, 100) } : event)
  // ... rest of handler
}
```

Then check backend logs (`tdsk dev log --context backend --follow`) while using a sandbox session. This will show:
- Whether `prompt-ready` events are ever emitted
- What `text` events look like (the actual content being parsed)
- Whether `activity` events are firing instead of `prompt-ready`

### Step 2: See what the active row contains

Add temporary logging to `ChangeDetector.process()` to see the active row text:

```typescript
if (!sealedAny && dirtyRows.length > 0) {
  const activeText = this.terminal.getLineText(cursor.y)
  console.log(`[ChangeDetector] active row text: "${activeText}", cursor: ${cursor.y}`)
  // ... rest of logic
}
```

This will show exactly what text the VT parser returns for the prompt line — essential for knowing if the regex can match it.

### Step 3: Test prompt regex against real output

Once you know what `activeText` looks like, test the regex:

```typescript
const text = "whatever getLineText returns"
console.log(/^[>$❯]\s*$/.test(text)) // Does it match?
```

### Step 4: Fix based on findings

The fix will be one of:
- **Regex too narrow**: Update `CCPromptPatternRegEx` to match the actual prompt format
- **`onActiveRow` not firing**: Debug the condition in `ChangeDetector.process()` 
- **`tryMatch` returning wrong result**: Debug `PatternMatcherPipeline.tryMatch()`
- **Event not reaching frontend**: Check that `broadcastEvent` sends it and `openSession.ts` dispatches it

## Key Files

| File | Role | Line refs |
|------|------|-----------|
| `repos/domain/src/parser/changeDetector.ts` | Detects sealed vs active rows | `onActiveRow` callback, `process()` method |
| `repos/domain/src/parser/terminalParser.ts` | Orchestrator — wires ChangeDetector to PatternMatcher | Lines 29-41, `onActiveRow` handler |
| `repos/domain/src/parser/patternMatcher.ts` | Runs matchers, `tryMatch()` for active row | `tryMatch()` method |
| `repos/domain/src/parser/matchers/claudeCode.ts` | Claude Code regexes | `prompt-ready` matcher, line 48 |
| `repos/domain/src/constants/parser.ts` | `CCPromptPatternRegEx` | Line 16 |
| `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | Backend event handler + broadcastEvent | Lines 512-547 (onEvent), broadcastEvent helper |
| `repos/threads/src/actions/sessions/openSession.ts` | Frontend event dispatch | Lines 148-159 (event handler) |
| `repos/domain/src/parser/deriveToolState.ts` | Maps event types to tool states | `prompt-ready` → `prompt` |
| `repos/threads/src/components/SmartInput/SmartInput.tsx` | UI that reads toolState | Line 238, renders based on `useToolState` |

## What Was Already Attempted (Did NOT Work)

1. Added `❯` to `CCPromptPatternRegEx`: `/^[>$❯]\s*$/`
2. Added `onActiveRow` callback to ChangeDetector that runs active row through `tryMatch()`
3. Added `tryMatch()` method to PatternMatcherPipeline

These changes are in the codebase but the issue persists. The most likely explanation is that `getLineText()` returns something that doesn't match the regex — either the prompt line has more content than just `❯`, or the active row isn't being checked at all.

## Related Context

- The terminal parser was redesigned in this session — see `docs/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md`
- The parser now uses ghostty-web's WASM VT parser instead of regex-based ANSI stripping
- Spec: `docs/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md`
- Plan: `docs/superpowers/plans/2026-04-12-terminal-parser-redesign.md`
- Memory: `memory/project_terminal_parser_redesign.md`
