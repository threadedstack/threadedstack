import type {
  RGB,
  TRect,
  TSpan,
  TLink,
  TGroup,
  TPanel,
  TTable,
  TConfirm,
  TTableRow,
  TDocument,
  TDiffBlock,
  TTextLine,
  TTextInput,
  TStatusBar,
  TSeparator,
  TSelectItem,
  TSelectList,
  TActionTarget,
  TContentNode,
  TViewportMode,
} from '@TTH/types/ast.types'

export const span = (
  text: string,
  fg: RGB,
  bg: RGB,
  flags: Partial<Omit<TSpan, 'type' | 'text' | 'fg' | 'bg'>> = {}
): TSpan => ({
  type: `Span`,
  text,
  fg,
  bg,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  faint: false,
  inverse: false,
  ...flags,
})

export const textLine = (bounds: TRect, children: TSpan[]): TTextLine => ({
  type: `TextLine`,
  bounds,
  children,
})

export const selectItem = (
  bounds: TRect,
  index: number,
  children: TSpan[],
  selected = false
): TSelectItem => ({
  type: `SelectItem`,
  bounds,
  selected,
  index,
  children,
})

export const tableRow = (
  bounds: TRect,
  cells: TSpan[][],
  isHeader = false
): TTableRow => ({
  type: `TableRow`,
  bounds,
  isHeader,
  cells,
})

export const statusBar = (bounds: TRect, segments: TSpan[][]): TStatusBar => ({
  type: `StatusBar`,
  bounds,
  segments,
})

export const confirm = (
  bounds: TRect,
  question: string,
  options: [string, string],
  focusedIndex: 0 | 1 = 0
): TConfirm => ({
  type: `Confirm`,
  bounds,
  question,
  options,
  focusedIndex,
})

export const textInput = (
  bounds: TRect,
  prompt: string,
  value: string,
  cursorOffset: number,
  suggestion?: string
): TTextInput => ({
  type: `TextInput`,
  bounds,
  prompt,
  value,
  cursorOffset,
  ...(suggestion !== undefined ? { suggestion } : {}),
})

export const actionTarget = (
  bounds: TRect,
  label: string,
  children: TSpan[],
  focused = false,
  hotkey?: string
): TActionTarget => ({
  type: `ActionTarget`,
  bounds,
  label,
  focused,
  children,
  ...(hotkey !== undefined ? { hotkey } : {}),
})

export const link = (
  bounds: TRect,
  hyperlinkId: number,
  children: TSpan[],
  url?: string
): TLink => ({
  type: `Link`,
  bounds,
  hyperlinkId,
  children,
  ...(url !== undefined ? { url } : {}),
})

export const separator = (
  bounds: TRect,
  style: TSeparator['style'] = `line`
): TSeparator => ({
  type: `Separator`,
  bounds,
  style,
})

export const selectList = (
  bounds: TRect,
  children: TSelectItem[],
  selectedIndex = 0,
  style: TSelectList['style'] = `arrow`
): TSelectList => ({
  type: `SelectList`,
  bounds,
  selectedIndex,
  style,
  children,
})

export const table = (
  bounds: TRect,
  children: TTableRow[],
  hasHeader = false
): TTable => ({
  type: `Table`,
  bounds,
  hasHeader,
  children,
})

export const diffBlock = (bounds: TRect, children: TTextLine[]): TDiffBlock => ({
  type: `DiffBlock`,
  bounds,
  children,
})

export const group = (bounds: TRect, children: TContentNode[]): TGroup => ({
  type: `Group`,
  bounds,
  children,
})

export const panel = (
  bounds: TRect,
  children: TContentNode[],
  border: TPanel['border'] = `single`,
  title?: string
): TPanel => ({
  type: `Panel`,
  bounds,
  border,
  children,
  ...(title !== undefined ? { title } : {}),
})

export const document = (
  bounds: TRect,
  children: TContentNode[],
  mode: TViewportMode = `idle`,
  cursor: TDocument['cursor'] = { x: 0, y: 0, visible: false }
): TDocument => ({
  type: `Document`,
  bounds,
  cursor,
  mode,
  children,
})
