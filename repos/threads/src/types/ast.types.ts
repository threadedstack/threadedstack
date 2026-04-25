// --- Geometry ---
export type TRect = { top: number; left: number; bottom: number; right: number }
export type RGB = { r: number; g: number; b: number }

// --- Cursor ---
export type TCursorState = { x: number; y: number; visible: boolean }

// --- Viewport Modes ---
export type TViewportMode = `interactive` | `tui` | `streaming` | `idle`

// --- Terminal Node (leaf) ---
export type TSpan = {
  fg: RGB
  bg: RGB
  type: `Span`
  text: string
  bold: boolean
  faint: boolean
  italic: boolean
  inverse: boolean
  underline: boolean
  strikethrough: boolean
}

// --- Leaf-ish Nodes ---
export type TTextLine = {
  bounds: TRect
  type: `TextLine`
  children: TSpan[]
}

export type TSelectItem = {
  bounds: TRect
  index: number
  type: `SelectItem`
  selected: boolean
  children: TSpan[]
}

export type TTableRow = {
  bounds: TRect
  type: `TableRow`
  cells: TSpan[][]
  isHeader: boolean
}

export type TStatusBar = {
  bounds: TRect
  type: `StatusBar`
  segments: TSpan[][]
}

export type TConfirm = {
  bounds: TRect
  type: `Confirm`
  question: string
  focusedIndex: 0 | 1
  options: [string, string]
}

export type TTextInput = {
  bounds: TRect
  value: string
  prompt: string
  type: `TextInput`
  suggestion?: string
  cursorOffset: number
}

export type TActionTarget = {
  bounds: TRect
  label: string
  hotkey?: string
  focused: boolean
  children: TSpan[]
  type: `ActionTarget`
}

export type TLink = {
  type: `Link`
  url?: string
  bounds: TRect
  children: TSpan[]
  hyperlinkId: number
}

export type TSeparator = {
  bounds: TRect
  type: `Separator`
  style: `blank` | `line` | `dashed`
}

// --- Container Nodes ---
export type TSelectList = {
  bounds: TRect
  type: `SelectList`
  selectedIndex: number
  children: TSelectItem[]
  style: `arrow` | `numbered` | `highlighted`
}

export type TTable = {
  type: `Table`
  bounds: TRect
  hasHeader: boolean
  children: TTableRow[]
}

export type TDiffBlock = {
  type: `DiffBlock`
  bounds: TRect
  children: TTextLine[]
}

export type TGroup = {
  type: `Group`
  bounds: TRect
  children: TContentNode[]
}

export type TPanel = {
  type: `Panel`
  bounds: TRect
  title?: string
  children: TContentNode[]
  border: `single` | `double` | `heavy` | `rounded`
}

// --- Content Node Union ---
export type TContentNode =
  | TLink
  | TPanel
  | TTable
  | TGroup
  | TConfirm
  | TTextLine
  | TDiffBlock
  | TSeparator
  | TTextInput
  | TStatusBar
  | TSelectList
  | TActionTarget

// --- Document Root ---
export type TDocument = {
  type: `Document`
  bounds: TRect
  cursor: TCursorState
  mode: TViewportMode
  children: TContentNode[]
}

// --- AST Node Union (all types) ---
export type TASTNode = TDocument | TContentNode | TSpan | TSelectItem | TTableRow

// --- Feed Event Types ---
export type TFeedEvent =
  | {
      kind: `action`
      id: string
      status: `running` | `done` | `error`
      action: string
      target: string
      detail?: TDocument
    }
  | {
      kind: `prompt`
      id: string
      status: `waiting` | `answered`
      question: string
      options?: string[]
      answer?: string
    }
  | {
      kind: `output`
      id: string
      status: `streaming` | `complete`
      lines: TTextLine[]
      summary?: string
      collapsed: boolean
    }
  | { kind: `tui`; id: string; status: `active` | `exited`; regionTree: TDocument }
  | { kind: `input`; id: string; text: string; source: `user` }
  | { kind: `idle`; id: string; timestamp: number }

// --- ARIA Props (from AccessibilityVisitor) ---
export type TAriaProps = Record<string, string | boolean | undefined>

// --- Interaction Handler ---
export type TInteractionHandler = {
  bounds: TRect
  label: string
  execute: () => void
  nodeType: TASTNode[`type`]
}
