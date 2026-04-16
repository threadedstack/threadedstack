import type { VTerminal } from '@TDM/parser/ghosttyVT'

/**
 * Strip leading non-alphanumeric characters (spinner chars, bullets, arrows)
 * so that "⠋ Hashing..." and "⠙ Hashing..." normalize to "Hashing...".
 */
function normalizeForDedup(text: string): string {
  return text.replace(/^[^\w\s]+\s*/, '').trim()
}

/**
 * Minimum fraction of rows that must be dirty (including both row 0
 * and the last row) for a write to be classified as a full-screen
 * TUI redraw. Below this threshold, output is treated as normal
 * sequential terminal output.
 */
const TuiDetectThreshold = 0.5

/**
 * Number of rows at the top and bottom of the terminal to suppress
 * in TUI mode. These are almost always header bars, tab bars, or
 * status bars — not content.
 */
const TuiEdgeRows = 2

export class ChangeDetector {
  private terminal: VTerminal
  private onSealedLine: (text: string, row: number) => void
  private onActiveRow: (text: string) => void
  private onActivity: () => void

  /**
   * Tracks the last-emitted text per row number. Used to suppress
   * identical re-emissions when TUI apps redraw the same content
   * on every spinner tick or screen refresh.
   */
  private previousRowContent = new Map<number, string>()

  /**
   * When true, the terminal is running a full-screen TUI app.
   * Edge rows (top/bottom) are suppressed as chrome.
   */
  private tuiMode = false

  /**
   * Count consecutive full-screen redraws. TUI mode requires at
   * least 2 in a row to avoid false positives from large initial
   * outputs or terminal creation clear-screen sequences.
   */
  private consecutiveFullRedraws = 0

  constructor(
    terminal: VTerminal,
    onSealedLine: (text: string, row: number) => void,
    onActiveRow: (text: string) => void = () => {},
    onActivity: () => void = () => {}
  ) {
    this.terminal = terminal
    this.onSealedLine = onSealedLine
    this.onActiveRow = onActiveRow
    this.onActivity = onActivity
  }

  process() {
    const dirtyRows = this.terminal.getDirtyRows()
    if (dirtyRows.length === 0) return

    const totalRows = this.terminal.rows
    const cursor = this.terminal.getCursor()

    // ── TUI mode detection ────────────────────────────────────────
    // A full-screen TUI app redraws many rows at once, spanning
    // from the top to the bottom of the terminal. We require 2
    // consecutive full-screen redraws to enter TUI mode — this
    // avoids false positives from one-off large outputs or the
    // initial terminal clear-screen sequence.
    const isFullRedraw =
      totalRows >= 8 &&
      dirtyRows.length >= totalRows * TuiDetectThreshold &&
      dirtyRows.includes(0) &&
      dirtyRows.includes(totalRows - 1)

    if (isFullRedraw) {
      this.consecutiveFullRedraws++
      if (!this.tuiMode && this.consecutiveFullRedraws >= 2) {
        this.tuiMode = true
      }
    } else {
      this.consecutiveFullRedraws = 0
    }

    let sealedAny = false
    let cursorRowDirty = false

    for (const row of dirtyRows) {
      if (row === cursor.y) {
        cursorRowDirty = true
        continue
      }

      // ── Edge row suppression in TUI mode ────────────────────────
      // Top and bottom rows in a full-screen TUI are almost always
      // chrome (header bar, status bar). Skip them.
      if (this.tuiMode) {
        if (row < TuiEdgeRows || row >= totalRows - TuiEdgeRows) continue
      }

      const text = this.terminal.getLineText(row)
      if (text.length > 0) {
        const prev = this.previousRowContent.get(row)

        // Exact dedup: same row, same text → skip
        if (prev === text) continue

        // Fuzzy dedup: same row, only leading chars changed (spinner animation)
        if (prev && normalizeForDedup(prev) === normalizeForDedup(text)) {
          this.previousRowContent.set(row, text)
          continue
        }

        this.previousRowContent.set(row, text)
        this.onSealedLine(text, row)
        sealedAny = true
      }
    }

    if (cursorRowDirty) {
      const activeText = this.terminal.getLineText(cursor.y)
      if (activeText.length > 0) {
        this.onActiveRow(activeText)
      } else if (!sealedAny) {
        this.onActivity()
      }
    } else if (!sealedAny && dirtyRows.length > 0) {
      this.onActivity()
    }

    this.terminal.markClean()
  }

  flush() {
    this.terminal.update()
    const cursor = this.terminal.getCursor()
    const text = this.terminal.getLineText(cursor.y)
    if (text.length > 0) {
      this.onSealedLine(text, cursor.y)
    }
    this.terminal.markClean()
  }

  /**
   * Clear the row content cache and exit TUI mode. Call on content
   * boundaries (e.g. prompt-ready) so that new content cycles start
   * fresh and TUI detection re-evaluates.
   */
  resetDedup() {
    this.previousRowContent.clear()
    this.tuiMode = false
    this.consecutiveFullRedraws = 0
  }
}
