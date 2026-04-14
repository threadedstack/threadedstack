import type { VTerminal } from '@TDM/parser/ghosttyVT'

export class ChangeDetector {
  private terminal: VTerminal
  private onSealedLine: (text: string) => void
  private onActiveRow: (text: string) => void
  private onActivity: () => void

  constructor(
    terminal: VTerminal,
    onSealedLine: (text: string) => void,
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

    const cursor = this.terminal.getCursor()
    let sealedAny = false
    let cursorRowDirty = false

    for (const row of dirtyRows) {
      if (row === cursor.y) {
        cursorRowDirty = true
        continue
      }

      const text = this.terminal.getLineText(row)
      if (text.length > 0) {
        this.onSealedLine(text)
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
      this.onSealedLine(text)
    }
    this.terminal.markClean()
  }
}
