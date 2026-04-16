import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { GhosttyVTCellSize, GhosttyVTConfigSize } from '@TDM/constants/parser'

type WasmExports = {
  memory: WebAssembly.Memory
  ghostty_terminal_new_with_config: (
    cols: number,
    rows: number,
    configPtr: number
  ) => number
  ghostty_terminal_free: (handle: number) => void
  ghostty_terminal_write: (handle: number, ptr: number, len: number) => void
  ghostty_terminal_resize: (handle: number, cols: number, rows: number) => void
  ghostty_terminal_is_alternate_screen: (handle: number) => number
  ghostty_render_state_update: (handle: number) => number
  ghostty_render_state_get_cursor_x: (handle: number) => number
  ghostty_render_state_get_cursor_y: (handle: number) => number
  ghostty_render_state_get_cursor_visible: (handle: number) => number
  ghostty_render_state_is_row_dirty: (handle: number, row: number) => boolean
  ghostty_render_state_mark_clean: (handle: number) => void
  ghostty_render_state_get_viewport: (
    handle: number,
    bufPtr: number,
    cellCount: number
  ) => number
  ghostty_wasm_alloc_u8_array: (len: number) => number
  ghostty_wasm_free_u8_array: (ptr: number, len: number) => void
}

export type TCellData = {
  codepoint: number
  /** Raw uint32 values for the 3 non-codepoint fields (bytes 4-15) */
  raw: [number, number, number]
}

export type TTextSegment = {
  text: string
  bold: boolean
  italic: boolean
}

export type VTerminal = {
  readonly cols: number
  readonly rows: number
  write: (data: string | Uint8Array) => void
  resize: (cols: number, rows: number) => void
  update: () => void
  getDirtyRows: () => number[]
  getLineText: (row: number) => string
  getLineSegments: (row: number) => TTextSegment[]
  getCellData: (row: number, col: number) => TCellData
  getCursor: () => { x: number; y: number; visible: boolean }
  isAlternateScreen: () => boolean
  markClean: () => void
  free: () => void
}

let singleton: GhosttyVT | null = null
let initPromise: Promise<GhosttyVT> | null = null

export class GhosttyVT {
  private exports: WasmExports
  private memory: WebAssembly.Memory
  private encoder = new TextEncoder()

  private constructor(instance: WebAssembly.Instance) {
    this.exports = instance.exports as unknown as WasmExports
    this.memory = this.exports.memory
  }

  static async init(): Promise<GhosttyVT> {
    if (singleton) return singleton
    if (initPromise) return initPromise
    initPromise = GhosttyVT._doInit()
    return initPromise
  }

  private static async _doInit(): Promise<GhosttyVT> {
    try {
      const require = createRequire(import.meta.url)
      const wasmPath = require.resolve('ghostty-web/ghostty-vt.wasm')
      const wasmBytes = await readFile(wasmPath)
      const compiled = await WebAssembly.compile(wasmBytes)

      let instance: WebAssembly.Instance
      instance = await WebAssembly.instantiate(compiled, {
        env: {
          log: (ptr: number, len: number) => {
            const buf = new Uint8Array(
              (instance.exports as unknown as WasmExports).memory.buffer,
              ptr,
              len
            )
            console.debug(`[ghostty-vt]`, new TextDecoder().decode(buf))
          },
        },
      })

      singleton = new GhosttyVT(instance)
      return singleton
    } catch (err) {
      initPromise = null
      throw err
    }
  }

  static createTerminal(cols = 80, rows = 24): VTerminal {
    if (!singleton)
      throw new Error(`GhosttyVT.init() must be called before createTerminal()`)
    const { exports, memory, encoder } = singleton

    // Allocate and zero config buffer
    const configPtr = exports.ghostty_wasm_alloc_u8_array(GhosttyVTConfigSize)
    new Uint8Array(memory.buffer).fill(0, configPtr, configPtr + GhosttyVTConfigSize)
    // scrollbackLimit = 0 (first 4 bytes already zero)
    const handle = exports.ghostty_terminal_new_with_config(cols, rows, configPtr)
    exports.ghostty_wasm_free_u8_array(configPtr, GhosttyVTConfigSize)

    if (!handle) throw new Error(`Failed to create ghostty terminal`)

    // Clear screen to initialize all cells (prevents stale WASM allocator data)
    const clearBytes = encoder.encode(`\x1b[2J\x1b[H`)
    const clearPtr = exports.ghostty_wasm_alloc_u8_array(clearBytes.length)
    new Uint8Array(memory.buffer).set(clearBytes, clearPtr)
    exports.ghostty_terminal_write(handle, clearPtr, clearBytes.length)
    exports.ghostty_wasm_free_u8_array(clearPtr, clearBytes.length)

    let _cols = cols
    let _rows = rows
    let _freed = false

    // Viewport cache: reuse viewport data within the same process() cycle
    let _viewportBufPtr = 0
    let _viewportBufSize = 0
    let _viewportFilled = false

    const allocViewport = () => {
      const cellCount = _cols * _rows
      const bufSize = cellCount * GhosttyVTCellSize
      if (_viewportBufPtr && _viewportBufSize !== bufSize) {
        exports.ghostty_wasm_free_u8_array(_viewportBufPtr, _viewportBufSize)
        _viewportBufPtr = 0
      }
      if (!_viewportBufPtr) {
        _viewportBufPtr = exports.ghostty_wasm_alloc_u8_array(bufSize)
        _viewportBufSize = bufSize
      }
      return { bufPtr: _viewportBufPtr, bufSize, cellCount }
    }

    const fillViewport = () => {
      const { bufPtr, bufSize, cellCount } = allocViewport()
      new Uint8Array(memory.buffer).fill(0, bufPtr, bufPtr + bufSize)
      exports.ghostty_render_state_get_viewport(handle, bufPtr, cellCount)
      _viewportFilled = true
      return bufPtr
    }

    const term: VTerminal = {
      get cols() {
        return _cols
      },
      get rows() {
        return _rows
      },

      write(data: string | Uint8Array) {
        if (_freed) return
        const bytes = typeof data === `string` ? encoder.encode(data) : data
        const ptr = exports.ghostty_wasm_alloc_u8_array(bytes.length)
        new Uint8Array(memory.buffer).set(bytes, ptr)
        exports.ghostty_terminal_write(handle, ptr, bytes.length)
        exports.ghostty_wasm_free_u8_array(ptr, bytes.length)
        _viewportFilled = false
      },

      resize(newCols: number, newRows: number) {
        if (_freed) return
        _cols = newCols
        _rows = newRows
        exports.ghostty_terminal_resize(handle, newCols, newRows)
        _viewportFilled = false
      },

      update() {
        if (_freed) return
        exports.ghostty_render_state_update(handle)
      },

      getDirtyRows(): number[] {
        if (_freed) return []
        exports.ghostty_render_state_update(handle)
        const dirty: number[] = []
        for (let r = 0; r < _rows; r++) {
          if (exports.ghostty_render_state_is_row_dirty(handle, r)) dirty.push(r)
        }
        return dirty
      },

      getLineText(row: number): string {
        if (_freed) return ``
        exports.ghostty_render_state_update(handle)

        if (!_viewportFilled) fillViewport()
        const bufPtr = _viewportBufPtr

        const view = new DataView(memory.buffer)
        const start = row * _cols
        let text = ``
        for (let i = 0; i < _cols; i++) {
          const cp = view.getUint32(bufPtr + (start + i) * GhosttyVTCellSize, true)
          text += cp === 0 ? ` ` : String.fromCodePoint(cp)
        }
        return text.trimEnd()
      },

      getLineSegments(row: number): TTextSegment[] {
        if (_freed) return []
        exports.ghostty_render_state_update(handle)

        if (!_viewportFilled) fillViewport()
        const bufPtr = _viewportBufPtr
        const view = new DataView(memory.buffer)
        const start = row * _cols

        // Build segments by walking cells and splitting on attribute changes
        const segments: TTextSegment[] = []
        let curText = ''
        let curBold = false
        let curItalic = false

        for (let i = 0; i < _cols; i++) {
          const cellOffset = bufPtr + (start + i) * GhosttyVTCellSize
          const cp = view.getUint32(cellOffset, true)
          const flags = view.getUint32(cellOffset + 8, true)
          const bold = (flags & 0x10000) !== 0
          const italic = (flags & 0x20000) !== 0
          const ch = cp === 0 ? ' ' : String.fromCodePoint(cp)

          if (i === 0) {
            curBold = bold
            curItalic = italic
          }

          if (bold !== curBold || italic !== curItalic) {
            if (curText.length > 0) {
              segments.push({ text: curText, bold: curBold, italic: curItalic })
            }
            curText = ch
            curBold = bold
            curItalic = italic
          } else {
            curText += ch
          }
        }

        if (curText.length > 0) {
          segments.push({ text: curText, bold: curBold, italic: curItalic })
        }

        // Trim trailing whitespace from the last segment
        if (segments.length > 0) {
          const last = segments[segments.length - 1]
          last.text = last.text.trimEnd()
          if (last.text.length === 0) segments.pop()
        }

        // Also trim trailing space-only segments
        while (
          segments.length > 0 &&
          segments[segments.length - 1].text.trim().length === 0
        ) {
          segments.pop()
        }

        return segments
      },

      getCellData(row: number, col: number): TCellData {
        if (_freed) return { codepoint: 0, raw: [0, 0, 0] }
        exports.ghostty_render_state_update(handle)

        if (!_viewportFilled) fillViewport()
        const bufPtr = _viewportBufPtr

        const view = new DataView(memory.buffer)
        const cellOffset = bufPtr + (row * _cols + col) * GhosttyVTCellSize
        return {
          codepoint: view.getUint32(cellOffset, true),
          raw: [
            view.getUint32(cellOffset + 4, true),
            view.getUint32(cellOffset + 8, true),
            view.getUint32(cellOffset + 12, true),
          ],
        }
      },

      getCursor() {
        if (_freed) return { x: 0, y: 0, visible: false }
        exports.ghostty_render_state_update(handle)
        return {
          x: exports.ghostty_render_state_get_cursor_x(handle),
          y: exports.ghostty_render_state_get_cursor_y(handle),
          visible: !!exports.ghostty_render_state_get_cursor_visible(handle),
        }
      },

      isAlternateScreen() {
        if (_freed) return false
        return !!exports.ghostty_terminal_is_alternate_screen(handle)
      },

      markClean() {
        if (_freed) return
        exports.ghostty_render_state_mark_clean(handle)
      },

      free() {
        if (_freed) return
        _freed = true
        if (_viewportBufPtr) {
          exports.ghostty_wasm_free_u8_array(_viewportBufPtr, _viewportBufSize)
          _viewportBufPtr = 0
          _viewportBufSize = 0
        }
        exports.ghostty_terminal_free(handle)
      },
    }

    return term
  }
}
