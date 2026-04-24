import type { RGB, TRect } from './ast.types'

// --- Decoded WASM Cell (16-byte structure) ---
export type TDecodedCell = {
  codepoint: number
  fg: RGB
  bg: RGB
  flags: number
  width: number
  hyperlinkId: number
  graphemeLen: number
}

// --- Cell Flags type ---
export type TCellFlags = {
  readonly BOLD: 0x01
  readonly ITALIC: 0x02
  readonly UNDERLINE: 0x04
  readonly STRIKETHROUGH: 0x08
  readonly INVERSE: 0x10
  readonly INVISIBLE: 0x20
  readonly BLINK: 0x40
  readonly FAINT: 0x80
}

// --- Cell Metadata (classification bits) ---
export type TCellMeta = {
  isBoxDraw: boolean
  isHighlighted: boolean
  isFgStyled: boolean
  isEmpty: boolean
  isBlank: boolean
  isWide: boolean
  isWideRight: boolean
  hasLink: boolean
}

// --- Terminal Color Palette ---
export type TPalette = {
  defaultBg: RGB
  defaultFg: RGB
}

// --- Raw Span (unclassified text run) ---
export type TRawSpan = {
  text: string
  fg: RGB
  bg: RGB
  flags: number
}

// --- Token Types ---
export type TBorderFrame = {
  type: `BorderFrame`
  bounds: TRect
  interior: TRect
  style: `single` | `double` | `heavy` | `rounded`
  title?: string
}

export type THighlightedBlock = {
  type: `HighlightedBlock`
  bounds: TRect
  color: RGB
  shape: `full-width` | `small` | `multi-row`
}

export type TTextRun = {
  type: `TextRun`
  bounds: TRect
  spans: TRawSpan[]
}

export type TWhitespaceGap = {
  type: `WhitespaceGap`
  bounds: TRect
  height: number
}

export type TLinkSpan = {
  type: `LinkSpan`
  bounds: TRect
  hyperlinkId: number
  text: string
}

export type TCursorToken = {
  type: `CursorToken`
  position: { x: number; y: number }
  visible: boolean
}

// --- Token Union ---
export type TToken =
  | TBorderFrame
  | THighlightedBlock
  | TTextRun
  | TWhitespaceGap
  | TLinkSpan
  | TCursorToken

// --- Tokenize Result ---
export type TTokenizeResult = {
  tokens: TToken[]
  cursor: TCursorToken
  palette: TPalette
  meta: TCellMeta[][]
}

// --- Viewport Fill (test utility) ---
export type TViewportFill = {
  row: number
  col: number
  text: string
  fg?: RGB
  bg?: RGB
  flags?: number
  width?: number
  hyperlinkId?: number
}

export type TTestViewport = {
  view: DataView
  cols: number
  rows: number
}

// --- Run Result ---
export type TRunResult = {
  textRuns: TTextRun[]
  gaps: TWhitespaceGap[]
  links: TLinkSpan[]
}
