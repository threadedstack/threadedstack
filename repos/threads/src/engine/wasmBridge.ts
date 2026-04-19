/**
 * Browser-compatible WASM bridge for ghostty-vt.
 *
 * Mirrors the Node.js GhosttyVT class in @tdsk/domain but uses browser
 * fetch + WebAssembly.compileStreaming instead of fs.readFile.
 * The compiled module is cached as a singleton so all terminals share it.
 */

import { GhosttyVTCellSize, GhosttyVTConfigSize } from '@TTH/tokenizer/types'

// Vite resolves `?url` imports to a hashed asset URL at build time.
import ghosttyWasmUrl from 'ghostty-web/ghostty-vt.wasm?url'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export type TBrowserVTerminal = {
  readonly cols: number
  readonly rows: number
  write: (data: string | Uint8Array) => void
  resize: (newCols: number, newRows: number) => void
  getDirtyRows: () => number[]
  /** Returns a DataView over the raw cell grid (cols × rows × 16 bytes). */
  getViewport: () => DataView
  getCursor: () => { x: number; y: number; visible: boolean }
  isAlternateScreen: () => boolean
  markClean: () => void
  free: () => void
}

// ---------------------------------------------------------------------------
// Module singleton
// ---------------------------------------------------------------------------

let compiledModule: WebAssembly.Module | null = null
let compilePromise: Promise<WebAssembly.Module> | null = null

async function getCompiledModule(): Promise<WebAssembly.Module> {
  if (compiledModule) return compiledModule
  if (compilePromise) return compilePromise

  compilePromise = WebAssembly.compileStreaming(fetch(ghosttyWasmUrl))
    .then((mod) => {
      compiledModule = mod
      return mod
    })
    .catch((err) => {
      compilePromise = null
      throw err
    })

  return compilePromise
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the WASM module (fetches + compiles once) then create a headless
 * terminal with the given dimensions.
 *
 * This is intentionally a standalone function, not a class, so callers don't
 * need to manage a singleton object themselves.
 */
export async function createBrowserTerminal(
  cols = 80,
  rows = 24
): Promise<TBrowserVTerminal> {
  const mod = await getCompiledModule()

  // We need a reference inside the env.log closure before the instance exists,
  // so we use a late-binding wrapper.
  let _exports: WasmExports | null = null

  const instance = await WebAssembly.instantiate(mod, {
    env: {
      log: (ptr: number, len: number) => {
        if (!_exports) return
        const buf = new Uint8Array(_exports.memory.buffer, ptr, len)
        console.debug('[ghostty-vt]', new TextDecoder().decode(buf))
      },
    },
  })

  _exports = instance.exports as unknown as WasmExports
  const exports = _exports
  const memory = exports.memory
  const encoder = new TextEncoder()

  // Allocate + zero config buffer, create terminal, free config buffer.
  const configPtr = exports.ghostty_wasm_alloc_u8_array(GhosttyVTConfigSize)
  new Uint8Array(memory.buffer).fill(0, configPtr, configPtr + GhosttyVTConfigSize)
  const handle = exports.ghostty_terminal_new_with_config(cols, rows, configPtr)
  exports.ghostty_wasm_free_u8_array(configPtr, GhosttyVTConfigSize)

  if (!handle) throw new Error('ghostty_terminal_new_with_config returned null handle')

  // Clear screen to initialise all cells (prevents stale WASM allocator data).
  const clearBytes = encoder.encode('\x1b[2J\x1b[H')
  const clearPtr = exports.ghostty_wasm_alloc_u8_array(clearBytes.length)
  new Uint8Array(memory.buffer).set(clearBytes, clearPtr)
  exports.ghostty_terminal_write(handle, clearPtr, clearBytes.length)
  exports.ghostty_wasm_free_u8_array(clearPtr, clearBytes.length)

  // Mutable dimensions (updated on resize).
  let _cols = cols
  let _rows = rows
  let _freed = false

  // Viewport buffer — reused across calls when size is unchanged.
  let _viewportBufPtr = 0
  let _viewportBufSize = 0

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

  const terminal: TBrowserVTerminal = {
    get cols() {
      return _cols
    },
    get rows() {
      return _rows
    },

    write(data: string | Uint8Array) {
      if (_freed) throw new Error('Terminal has been freed')
      const bytes = typeof data === 'string' ? encoder.encode(data) : data
      const ptr = exports.ghostty_wasm_alloc_u8_array(bytes.length)
      new Uint8Array(memory.buffer).set(bytes, ptr)
      exports.ghostty_terminal_write(handle, ptr, bytes.length)
      exports.ghostty_wasm_free_u8_array(ptr, bytes.length)
    },

    resize(newCols: number, newRows: number) {
      if (_freed) throw new Error('Terminal has been freed')
      _cols = newCols
      _rows = newRows
      exports.ghostty_terminal_resize(handle, newCols, newRows)
    },

    getDirtyRows(): number[] {
      if (_freed) throw new Error('Terminal has been freed')
      exports.ghostty_render_state_update(handle)
      const dirty: number[] = []
      for (let r = 0; r < _rows; r++) {
        if (exports.ghostty_render_state_is_row_dirty(handle, r)) dirty.push(r)
      }
      return dirty
    },

    getViewport(): DataView {
      if (_freed) throw new Error('Terminal has been freed')
      exports.ghostty_render_state_update(handle)
      const { bufPtr, bufSize, cellCount } = allocViewport()
      new Uint8Array(memory.buffer).fill(0, bufPtr, bufPtr + bufSize)
      exports.ghostty_render_state_get_viewport(handle, bufPtr, cellCount)
      return new DataView(memory.buffer, bufPtr, bufSize)
    },

    getCursor() {
      if (_freed) throw new Error('Terminal has been freed')
      exports.ghostty_render_state_update(handle)
      return {
        x: exports.ghostty_render_state_get_cursor_x(handle),
        y: exports.ghostty_render_state_get_cursor_y(handle),
        visible: !!exports.ghostty_render_state_get_cursor_visible(handle),
      }
    },

    isAlternateScreen() {
      if (_freed) throw new Error('Terminal has been freed')
      return !!exports.ghostty_terminal_is_alternate_screen(handle)
    },

    markClean() {
      if (_freed) throw new Error('Terminal has been freed')
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

  return terminal
}
