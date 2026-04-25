import type {
  TDocument,
  TContentNode,
  TFeedEvent,
  TTextLine,
  TSelectList,
  TTextInput,
  TDiffBlock,
} from '@TTH/types'

// Monotonic counter for event IDs
let _counter = 0
function nextId(): string {
  return `feed-${++_counter}`
}

/**
 * Recursively walks doc.children to collect all nodes of a given type.
 */
export function findNodesByType<T extends TContentNode>(
  doc: TDocument | TContentNode,
  typeName: string
): T[] {
  const results: T[] = []
  const children = `children` in doc ? (doc.children as TContentNode[]) : []
  for (const child of children) {
    if (child.type === typeName) {
      results.push(child as T)
    }
    // Recurse into container nodes
    if (`children` in child) {
      results.push(...findNodesByType<T>(child, typeName))
    }
  }
  return results
}

/**
 * Extract the plain text of a TextLine for comparison.
 */
function lineText(line: TTextLine): string {
  return line.children.map((s) => s.text).join(``)
}

/**
 * Build a content fingerprint from a set of TextLines for change detection.
 */
function linesFingerprint(lines: TTextLine[]): string {
  return lines.map(lineText).join(`\n`)
}

/**
 * Count how many lines differ between two sets (by text content).
 */
function countChangedLines(prev: TTextLine[], next: TTextLine[]): number {
  const len = Math.min(prev.length, next.length)
  let changed = 0
  for (let i = 0; i < len; i++) {
    if (lineText(prev[i]) !== lineText(next[i])) changed++
  }
  return changed + Math.abs(prev.length - next.length)
}

/**
 * Compares two consecutive AST snapshots and produces feed events.
 */
export function diffToFeedEvents(prev: TDocument, next: TDocument): TFeedEvent[] {
  const events: TFeedEvent[] = []

  // 1. Mode transitions
  if (next.mode === `idle` && prev.mode !== `idle`) {
    events.push({ kind: `idle`, id: nextId(), timestamp: Date.now() })
  }
  if (next.mode === `tui`) {
    events.push({ kind: `tui`, id: nextId(), status: `active`, regionTree: next })
  }
  if (prev.mode === `tui` && next.mode !== `tui`) {
    events.push({ kind: `tui`, id: nextId(), status: `exited`, regionTree: prev })
  }

  // 2. TextInput appeared / disappeared
  const prevInputs = findNodesByType<TTextInput>(prev, `TextInput`)
  const nextInputs = findNodesByType<TTextInput>(next, `TextInput`)
  if (nextInputs.length > prevInputs.length) {
    const appeared = nextInputs[nextInputs.length - 1]
    events.push({
      kind: `prompt`,
      id: nextId(),
      status: `waiting`,
      question: appeared.prompt,
    })
  } else if (prevInputs.length > nextInputs.length) {
    const disappeared = prevInputs[prevInputs.length - 1]
    events.push({
      kind: `prompt`,
      id: nextId(),
      status: `answered`,
      question: disappeared.prompt,
    })
  }

  // 3. SelectList appeared (with content change — not just same list re-rendered)
  const prevSelects = findNodesByType<TSelectList>(prev, `SelectList`)
  const nextSelects = findNodesByType<TSelectList>(next, `SelectList`)
  if (nextSelects.length > prevSelects.length) {
    const appeared = nextSelects[nextSelects.length - 1]
    const options = appeared.children
      .filter((item) => {
        const text = item.children
          .map((span) => span.text)
          .join(``)
          .trim()
        // Filter out items that are purely separator/decoration characters
        return text.length > 0 && !/^[─━╌╍┄┈═╼╾\-=_·•●]+$/.test(text)
      })
      .map((item) => item.children.map((span) => span.text).join(``))

    if (options.length > 0) {
      events.push({
        kind: `prompt`,
        id: nextId(),
        status: `waiting`,
        question: `Select an option`,
        options,
      })
    }
  }

  // 4. DiffBlock appeared
  const prevDiffs = findNodesByType<TDiffBlock>(prev, `DiffBlock`)
  const nextDiffs = findNodesByType<TDiffBlock>(next, `DiffBlock`)
  if (nextDiffs.length > prevDiffs.length) {
    events.push({
      kind: `action`,
      id: nextId(),
      status: `running`,
      action: `edit`,
      target: `file`,
    })
  }

  // 5. New or changed TextLine content in streaming or interactive mode
  if (next.mode === `streaming` || next.mode === `interactive`) {
    const prevLines = findNodesByType<TTextLine>(prev, `TextLine`)
    const nextLines = findNodesByType<TTextLine>(next, `TextLine`)
    const newCount = nextLines.length - prevLines.length

    if (newCount > 0) {
      // New lines appended
      events.push({
        kind: `output`,
        id: nextId(),
        status: next.mode === `streaming` ? `streaming` : `complete`,
        lines: nextLines.slice(prevLines.length),
        collapsed: false,
      })
    } else if (nextLines.length > 0) {
      // Same or fewer lines — check if content changed significantly.
      // TUI apps (like CC) redraw the viewport in place using cursor positioning.
      // Detect when the viewport content changed substantially (>3 lines differ).
      const changedCount = countChangedLines(prevLines, nextLines)
      if (changedCount > 3) {
        const prevFp = linesFingerprint(prevLines)
        const nextFp = linesFingerprint(nextLines)
        if (prevFp !== nextFp) {
          // Collect only the lines that actually changed
          const changedLines = nextLines.filter((line, i) => {
            if (i >= prevLines.length) return true
            return lineText(prevLines[i]) !== lineText(line)
          })
          // Filter out empty/whitespace-only lines
          const meaningful = changedLines.filter(
            (line) => lineText(line).trim().length > 0
          )
          if (meaningful.length > 0) {
            events.push({
              kind: `output`,
              id: nextId(),
              status: `complete`,
              lines: meaningful,
              collapsed: meaningful.length > 5,
            })
          }
        }
      }
    }
  }

  return events
}
