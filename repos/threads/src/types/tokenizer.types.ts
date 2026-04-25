import type { RGB, TRect } from './ast.types'

// --- Decoded WASM Cell (16-byte structure) ---
export type TDecodedCell = {
  fg: RGB
  bg: RGB
  flags: number
  width: number
  codepoint: number
  hyperlinkId: number
  graphemeLen: number
}

// --- Cell Metadata (classification bits) ---
export type TCellMeta = {
  isWide: boolean
  isEmpty: boolean
  isBlank: boolean
  hasLink: boolean
  isBoxDraw: boolean
  isFgStyled: boolean
  isWideRight: boolean
  isHighlighted: boolean
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
  bounds: TRect
  title?: string
  interior: TRect
  type: `BorderFrame`
  style: `single` | `double` | `heavy` | `rounded`
}

export type THighlightedBlock = {
  color: RGB
  bounds: TRect
  type: `HighlightedBlock`
  shape: `full-width` | `small` | `multi-row`
}

export type TTextRun = {
  bounds: TRect
  type: `TextRun`
  spans: TRawSpan[]
}

export type TWhitespaceGap = {
  bounds: TRect
  height: number
  type: `WhitespaceGap`
}

export type TLinkSpan = {
  text: string
  bounds: TRect
  type: `LinkSpan`
  hyperlinkId: number
}

export type TCursorToken = {
  visible: boolean
  type: `CursorToken`
  position: { x: number; y: number }
}

// --- Token Union ---
export type TToken =
  | TTextRun
  | TLinkSpan
  | TCursorToken
  | TBorderFrame
  | TWhitespaceGap
  | THighlightedBlock

// --- Tokenize Result ---
export type TTokenizeResult = {
  tokens: TToken[]
  palette: TPalette
  meta: TCellMeta[][]
  cursor: TCursorToken
}

// --- Run Result ---
export type TRunResult = {
  links: TLinkSpan[]
  textRuns: TTextRun[]
  gaps: TWhitespaceGap[]
}

export type TViewportFill = {
  fg?: RGB
  bg?: RGB
  row: number
  col: number
  text: string
  flags?: number
  width?: number
  hyperlinkId?: number
}

export type TTestViewport = {
  cols: number
  rows: number
  view: DataView
}
