// --- Geometry ---
export type TRect = { top: number; left: number; bottom: number; right: number }
export type RGB = { r: number; g: number; b: number }

// --- Viewport Modes ---
export type TViewportMode = 'interactive' | 'tui' | 'streaming' | 'idle'

// --- Terminal Node (leaf) ---
export type TSpan = {
  type: 'Span'
  text: string
  fg: RGB
  bg: RGB
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  faint: boolean
  inverse: boolean
}

// --- Leaf-ish Nodes ---
export type TTextLine = {
  type: 'TextLine'
  bounds: TRect
  children: TSpan[]
}

export type TSelectItem = {
  type: 'SelectItem'
  bounds: TRect
  selected: boolean
  index: number
  children: TSpan[]
}

export type TTableRow = {
  type: 'TableRow'
  bounds: TRect
  isHeader: boolean
  cells: TSpan[][]
}

export type TStatusBar = {
  type: 'StatusBar'
  bounds: TRect
  segments: TSpan[][]
}

export type TConfirm = {
  type: 'Confirm'
  bounds: TRect
  question: string
  options: [string, string]
  focusedIndex: 0 | 1
}

export type TTextInput = {
  type: 'TextInput'
  bounds: TRect
  prompt: string
  value: string
  cursorOffset: number
  suggestion?: string
}

export type TActionTarget = {
  type: 'ActionTarget'
  bounds: TRect
  label: string
  hotkey?: string
  focused: boolean
  children: TSpan[]
}

export type TLink = {
  type: 'Link'
  bounds: TRect
  hyperlinkId: number
  url?: string
  children: TSpan[]
}

export type TSeparator = {
  type: 'Separator'
  bounds: TRect
  style: 'blank' | 'line' | 'dashed'
}

// --- Container Nodes ---
export type TSelectList = {
  type: 'SelectList'
  bounds: TRect
  selectedIndex: number
  style: 'arrow' | 'numbered' | 'highlighted'
  children: TSelectItem[]
}

export type TTable = {
  type: 'Table'
  bounds: TRect
  hasHeader: boolean
  children: TTableRow[]
}

export type TDiffBlock = {
  type: 'DiffBlock'
  bounds: TRect
  children: TTextLine[]
}

export type TGroup = {
  type: 'Group'
  bounds: TRect
  children: TContentNode[]
}

export type TPanel = {
  type: 'Panel'
  bounds: TRect
  border: 'single' | 'double' | 'heavy' | 'rounded'
  title?: string
  children: TContentNode[]
}

// --- Content Node Union ---
export type TContentNode =
  | TPanel
  | TGroup
  | TTextLine
  | TSelectList
  | TConfirm
  | TTextInput
  | TActionTarget
  | TStatusBar
  | TTable
  | TDiffBlock
  | TLink
  | TSeparator

// --- Document Root ---
export type TDocument = {
  type: 'Document'
  bounds: TRect
  cursor: { x: number; y: number; visible: boolean }
  mode: TViewportMode
  children: TContentNode[]
}

// --- AST Node Union (all types) ---
export type TASTNode = TDocument | TContentNode | TSpan | TSelectItem | TTableRow

// --- Feed Event Types ---
export type TFeedEvent =
  | {
      kind: 'action'
      id: string
      status: 'running' | 'done' | 'error'
      action: string
      target: string
      detail?: TDocument
    }
  | {
      kind: 'prompt'
      id: string
      status: 'waiting' | 'answered'
      question: string
      options?: string[]
      answer?: string
    }
  | {
      kind: 'output'
      id: string
      status: 'streaming' | 'complete'
      lines: TTextLine[]
      summary?: string
      collapsed: boolean
    }
  | { kind: 'tui'; id: string; status: 'active' | 'exited'; regionTree: TDocument }
  | { kind: 'input'; id: string; text: string; source: 'user' }
  | { kind: 'idle'; id: string; timestamp: number }

// --- ARIA Props (from AccessibilityVisitor) ---
export type TAriaProps = Record<string, string | boolean | undefined>

// --- Interaction Handler ---
export type TInteractionHandler = {
  nodeType: string
  bounds: TRect
  label: string
  execute: () => void
}
