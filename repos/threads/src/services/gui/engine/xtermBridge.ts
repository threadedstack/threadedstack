import type { TBrowserVTerminal } from '@TTH/types'

import { Terminal } from '@xterm/headless'
import { VTCellSize, CellFlags } from '@TTH/constants/tokenizer'

const Ansi256Palette: ReadonlyArray<readonly [number, number, number]> =
  buildAnsi256Palette()

function buildAnsi256Palette(): Array<[number, number, number]> {
  const palette: Array<[number, number, number]> = []

  const standard: Array<[number, number, number]> = [
    [0, 0, 0],
    [128, 0, 0],
    [0, 128, 0],
    [128, 128, 0],
    [0, 0, 128],
    [128, 0, 128],
    [0, 128, 128],
    [192, 192, 192],
  ]
  palette.push(...standard)

  const bright: Array<[number, number, number]> = [
    [128, 128, 128],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [0, 0, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
  ]
  palette.push(...bright)

  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette.push([r ? r * 40 + 55 : 0, g ? g * 40 + 55 : 0, b ? b * 40 + 55 : 0])
      }
    }
  }

  for (let i = 0; i < 24; i++) {
    const v = i * 10 + 8
    palette.push([v, v, v])
  }

  return palette
}

function resolveColor(
  color: number,
  isRGB: boolean,
  isPalette: boolean,
  defaultR: number,
  defaultG: number,
  defaultB: number
): [number, number, number] {
  if (isRGB) {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
  }
  if (isPalette) {
    const entry = Ansi256Palette[color]
    return entry ? [entry[0], entry[1], entry[2]] : [defaultR, defaultG, defaultB]
  }
  return [defaultR, defaultG, defaultB]
}

export function createBrowserTerminal(cols = 80, rows = 24): TBrowserVTerminal {
  const term = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true })

  let _allDirty = false
  let _freed = false
  let _viewportBuf: ArrayBuffer | null = null
  let _viewportBufSize = 0

  const terminal: TBrowserVTerminal = {
    get cols() {
      return term.cols
    },
    get rows() {
      return term.rows
    },

    write(data: string | Uint8Array) {
      if (_freed) throw new Error(`Terminal has been freed`)
      term.write(data, () => {
        _allDirty = true
      })
    },

    resize(newCols: number, newRows: number) {
      if (_freed) throw new Error(`Terminal has been freed`)
      term.resize(newCols, newRows)
      _allDirty = true
    },

    getDirtyRows(): number[] {
      if (_freed) throw new Error(`Terminal has been freed`)
      if (!_allDirty) return []
      const rows: number[] = []
      for (let r = 0; r < term.rows; r++) rows.push(r)
      return rows
    },

    getViewport(): DataView {
      if (_freed) throw new Error(`Terminal has been freed`)
      const c = term.cols
      const r = term.rows
      const totalBytes = c * r * VTCellSize

      if (!_viewportBuf || _viewportBufSize !== totalBytes) {
        _viewportBuf = new ArrayBuffer(totalBytes)
        _viewportBufSize = totalBytes
      } else {
        new Uint8Array(_viewportBuf).fill(0)
      }

      const view = new DataView(_viewportBuf)
      const buf = term.buffer.active
      const cell = buf.getNullCell()

      for (let row = 0; row < r; row++) {
        const line = buf.getLine(buf.baseY + row)
        if (!line) continue

        for (let col = 0; col < c; col++) {
          line.getCell(col, cell)
          const offset = (row * c + col) * VTCellSize

          const codepoint = cell.getCode()
          view.setUint32(offset, codepoint, true)

          const [fgR, fgG, fgB] = resolveColor(
            cell.getFgColor(),
            cell.isFgRGB(),
            cell.isFgPalette(),
            255,
            255,
            255
          )
          view.setUint8(offset + 4, fgR)
          view.setUint8(offset + 5, fgG)
          view.setUint8(offset + 6, fgB)

          const [bgR, bgG, bgB] = resolveColor(
            cell.getBgColor(),
            cell.isBgRGB(),
            cell.isBgPalette(),
            0,
            0,
            0
          )
          view.setUint8(offset + 7, bgR)
          view.setUint8(offset + 8, bgG)
          view.setUint8(offset + 9, bgB)

          let flags = 0
          if (cell.isBold()) flags |= CellFlags.BOLD
          if (cell.isItalic()) flags |= CellFlags.ITALIC
          if (cell.isUnderline()) flags |= CellFlags.UNDERLINE
          if (cell.isStrikethrough()) flags |= CellFlags.STRIKETHROUGH
          if (cell.isInverse()) flags |= CellFlags.INVERSE
          if (cell.isInvisible()) flags |= CellFlags.INVISIBLE
          if (cell.isBlink()) flags |= CellFlags.BLINK
          if (cell.isDim()) flags |= CellFlags.FAINT
          view.setUint8(offset + 10, flags)

          view.setUint8(offset + 11, cell.getWidth())

          view.setUint16(offset + 12, 0, true)

          const chars = cell.getChars()
          view.setUint8(offset + 14, chars.length)
        }
      }

      return view
    },

    getCursor() {
      if (_freed) throw new Error(`Terminal has been freed`)
      const buf = term.buffer.active
      return {
        x: buf.cursorX,
        y: buf.cursorY,
        visible: buf.type !== `alternate`,
      }
    },

    isAlternateScreen() {
      if (_freed) throw new Error(`Terminal has been freed`)
      return term.buffer.active.type === `alternate`
    },

    markClean() {
      if (_freed) throw new Error(`Terminal has been freed`)
      _allDirty = false
    },

    free() {
      if (_freed) return
      _freed = true
      _viewportBuf = null
      _viewportBufSize = 0
      term.dispose()
    },
  }

  return terminal
}
