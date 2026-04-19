import type { RGB, TRect } from '../ast'

/**
 * GhosttyVT constants — duplicated from @tdsk/domain/constants/parser
 * to avoid cross-package runtime dependency that breaks Vite's browser
 * module resolution (domain's parser barrel imports node:fs/promises).
 */
export const GhosttyVTCellSize = 16
export const GhosttyVTConfigSize = 80

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

// --- Cell Flags bitmask constants ---
export const CellFlags = {
  BOLD: 0x01,
  ITALIC: 0x02,
  UNDERLINE: 0x04,
  STRIKETHROUGH: 0x08,
  INVERSE: 0x10,
  INVISIBLE: 0x20,
  BLINK: 0x40,
  FAINT: 0x80,
} as const

export type TCellFlags = typeof CellFlags

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
  type: 'BorderFrame'
  bounds: TRect
  interior: TRect
  style: 'single' | 'double' | 'heavy' | 'rounded'
  title?: string
}

export type THighlightedBlock = {
  type: 'HighlightedBlock'
  bounds: TRect
  color: RGB
  shape: 'full-width' | 'small' | 'multi-row'
}

export type TTextRun = {
  type: 'TextRun'
  bounds: TRect
  spans: TRawSpan[]
}

export type TWhitespaceGap = {
  type: 'WhitespaceGap'
  bounds: TRect
  height: number
}

export type TLinkSpan = {
  type: 'LinkSpan'
  bounds: TRect
  hyperlinkId: number
  text: string
}

export type TCursorToken = {
  type: 'CursorToken'
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
