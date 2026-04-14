import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'
import { ChangeDetector } from './changeDetector'

describe('ChangeDetector', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  it('emits sealed lines when cursor moves past them', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Line one\r\n')
    detector.process()

    expect(lines).toContain('Line one')
  })

  it('does not emit the active row (cursor still on it)', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Partial')
    detector.process()

    // 'Partial' is on the cursor's row — should not be emitted
    expect(lines).not.toContain('Partial')
  })

  it('emits activity when active row is dirty but no lines sealed', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    let activityCount = 0
    const detector = new ChangeDetector(
      term,
      (line) => lines.push(line),
      () => activityCount++
    )

    term.write('Spinner frame')
    detector.process()

    expect(lines.length).toBe(0)
    expect(activityCount).toBe(1)
  })

  it('seals active row only after cursor advances', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('First')
    detector.process()
    expect(lines.length).toBe(0)

    term.write('\r\nSecond')
    detector.process()
    expect(lines).toContain('First')
    expect(lines).not.toContain('Second')
  })

  it('handles CR overwrites — only emits final content', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Loading... 0%')
    detector.process()
    term.write('\rLoading... 50%')
    detector.process()
    term.write('\rLoading... 100%')
    detector.process()
    // Still active row — nothing emitted
    expect(lines.length).toBe(0)

    term.write('\r\n')
    detector.process()
    expect(lines.length).toBe(1)
    expect(lines[0]).toMatch(/Loading\.\.\. 100%/)
  })

  it('emits multiple sealed lines from a single write', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Line A\r\nLine B\r\nLine C\r\n')
    detector.process()

    expect(lines).toContain('Line A')
    expect(lines).toContain('Line B')
    expect(lines).toContain('Line C')
  })

  it('flush seals the active row', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Unflushed content')
    detector.process()
    expect(lines.length).toBe(0)

    detector.flush()
    expect(lines).toContain('Unflushed content')
  })

  it('skips empty lines', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('\r\n\r\n\r\n')
    detector.process()

    // Empty lines should not produce sealed line callbacks
    expect(lines.every((l) => l.trim().length > 0)).toBe(true)
  })

  it('does not emit activity when no rows are dirty', () => {
    term = GhosttyVT.createTerminal()
    let activityCount = 0
    const detector = new ChangeDetector(
      term,
      () => {},
      () => activityCount++
    )

    // Drain initial dirty state from terminal creation (clear-screen escape)
    detector.process()
    activityCount = 0

    // No writes after drain — process should produce zero callbacks
    detector.process()
    expect(activityCount).toBe(0)
  })

  it('calls onActiveRow even when sealed lines are present in the same batch', () => {
    term = GhosttyVT.createTerminal()
    const sealed: string[] = []
    const activeRows: string[] = []
    const detector = new ChangeDetector(
      term,
      (line) => sealed.push(line),
      (text) => activeRows.push(text)
    )

    // Simulate output + prompt arriving in a single write
    // "Output line" is sealed (cursor moves past), "❯" stays on cursor row
    term.write('Output line\r\n❯ ')
    detector.process()

    expect(sealed).toContain('Output line')
    expect(activeRows.length).toBe(1)
    expect(activeRows[0]).toBe('❯')
  })

  it('calls onActiveRow for cursor row when multiple sealed lines are present', () => {
    term = GhosttyVT.createTerminal()
    const sealed: string[] = []
    const activeRows: string[] = []
    const detector = new ChangeDetector(
      term,
      (line) => sealed.push(line),
      (text) => activeRows.push(text)
    )

    term.write('Line A\r\nLine B\r\nLine C\r\nPrompt>')
    detector.process()

    expect(sealed).toContain('Line A')
    expect(sealed).toContain('Line B')
    expect(sealed).toContain('Line C')
    expect(activeRows.length).toBe(1)
    expect(activeRows[0]).toContain('Prompt>')
  })

  it('flush followed by process without new writes does not re-emit flushed line', () => {
    term = GhosttyVT.createTerminal(80, 24)
    const sealed: string[] = []
    const detector = new ChangeDetector(
      term,
      (text) => sealed.push(text),
      () => {}
    )

    term.write('Hello')
    detector.process()
    expect(sealed).toEqual([])

    detector.flush()
    expect(sealed).toEqual(['Hello'])

    // Without any new writes, process should not re-emit "Hello"
    // because flush calls markClean after emitting
    detector.process()
    expect(sealed).toEqual(['Hello'])
  })
})
