import { useReducer, useCallback, useMemo } from 'react'

/**
 * Convert a 1D cursor offset into a 2D {row, col} position.
 */
export function positionFromOffset(
  text: string,
  offset: number
): { row: number; col: number } {
  let row = 0
  let col = 0
  for (let i = 0; i < offset; i++) {
    if (text[i] === `\n`) {
      row++
      col = 0
    } else {
      col++
    }
  }
  return { row, col }
}

/**
 * Convert a 2D {row, col} position into a 1D offset.
 */
export function offsetFromPosition(lines: string[], row: number, col: number): number {
  let offset = 0
  for (let r = 0; r < row; r++) {
    offset += lines[r].length + 1 // +1 for the \n
  }
  return offset + col
}

/**
 * Find the start of the previous word boundary (for Ctrl+W / Ctrl+Left).
 */
export function findWordBoundaryLeft(text: string, cursor: number): number {
  if (cursor <= 0) return 0
  let i = cursor - 1
  // Skip whitespace/non-word chars
  while (i > 0 && /\W/.test(text[i])) i--
  // Skip word chars
  while (i > 0 && /\w/.test(text[i - 1])) i--
  return i
}

/**
 * Find the end of the next word boundary (for Ctrl+Right).
 */
export function findWordBoundaryRight(text: string, cursor: number): number {
  const len = text.length
  if (cursor >= len) return len
  let i = cursor
  // Skip word chars
  while (i < len && /\w/.test(text[i])) i++
  // Skip non-word chars
  while (i < len && /\W/.test(text[i])) i++
  return i
}

export type TEditorAction =
  | { type: 'INSERT'; chars: string }
  | { type: 'DELETE_BACKWARD' }
  | { type: 'DELETE_FORWARD' }
  | { type: 'DELETE_WORD_BACKWARD' }
  | { type: 'KILL_TO_END' }
  | { type: 'KILL_TO_START' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'MOVE_WORD_LEFT' }
  | { type: 'MOVE_WORD_RIGHT' }
  | { type: 'MOVE_TO_LINE_START' }
  | { type: 'MOVE_TO_LINE_END' }
  | { type: 'SET_TEXT'; text: string }
  | { type: 'CLEAR' }

type TInternalState = {
  text: string
  cursor: number
  desiredCol: number
}

const initialState: TInternalState = { text: ``, cursor: 0, desiredCol: 0 }

function withDesiredCol(
  state: TInternalState,
  text: string,
  cursor: number
): TInternalState {
  const pos = positionFromOffset(text, cursor)
  return { text, cursor, desiredCol: pos.col }
}

export function editorReducer(
  state: TInternalState,
  action: TEditorAction
): TInternalState {
  switch (action.type) {
    case 'INSERT': {
      const newText =
        state.text.slice(0, state.cursor) + action.chars + state.text.slice(state.cursor)
      const newCursor = state.cursor + action.chars.length
      return withDesiredCol(state, newText, newCursor)
    }

    case 'DELETE_BACKWARD': {
      if (state.cursor <= 0) return state
      const newText =
        state.text.slice(0, state.cursor - 1) + state.text.slice(state.cursor)
      const newCursor = state.cursor - 1
      return withDesiredCol(state, newText, newCursor)
    }

    case 'DELETE_FORWARD': {
      if (state.cursor <= 0) return state
      const newText =
        state.text.slice(0, state.cursor - 1) + state.text.slice(state.cursor)
      const newCursor = state.cursor - 1
      return withDesiredCol(state, newText, newCursor)
    }

    case 'DELETE_WORD_BACKWARD': {
      if (state.cursor <= 0) return state
      const target = findWordBoundaryLeft(state.text, state.cursor)
      const newText = state.text.slice(0, target) + state.text.slice(state.cursor)
      return withDesiredCol(state, newText, target)
    }

    case 'KILL_TO_END': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      const lineEnd = lines[pos.row].length

      if (pos.col === lineEnd && pos.row < lines.length - 1) {
        const endOffset = offsetFromPosition(lines, pos.row, lineEnd)
        const newText = state.text.slice(0, endOffset) + state.text.slice(endOffset + 1)
        return { ...state, text: newText }
      }

      const endOffset = offsetFromPosition(lines, pos.row, lineEnd)
      const newText = state.text.slice(0, state.cursor) + state.text.slice(endOffset)
      return { ...state, text: newText }
    }

    case 'KILL_TO_START': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      if (pos.col === 0) return state
      const lineStartOffset = offsetFromPosition(lines, pos.row, 0)
      const newText =
        state.text.slice(0, lineStartOffset) + state.text.slice(state.cursor)
      return { text: newText, cursor: lineStartOffset, desiredCol: 0 }
    }

    case 'MOVE_LEFT': {
      if (state.cursor <= 0) return state
      const newCursor = state.cursor - 1
      return withDesiredCol(state, state.text, newCursor)
    }

    case 'MOVE_RIGHT': {
      if (state.cursor >= state.text.length) return state
      const newCursor = state.cursor + 1
      return withDesiredCol(state, state.text, newCursor)
    }

    case 'MOVE_UP': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      if (pos.row <= 0) return state
      const targetRow = pos.row - 1
      const targetCol = Math.min(state.desiredCol, lines[targetRow].length)
      return { ...state, cursor: offsetFromPosition(lines, targetRow, targetCol) }
    }

    case 'MOVE_DOWN': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      if (pos.row >= lines.length - 1) return state
      const targetRow = pos.row + 1
      const targetCol = Math.min(state.desiredCol, lines[targetRow].length)
      return { ...state, cursor: offsetFromPosition(lines, targetRow, targetCol) }
    }

    case 'MOVE_WORD_LEFT': {
      const target = findWordBoundaryLeft(state.text, state.cursor)
      return withDesiredCol(state, state.text, target)
    }

    case 'MOVE_WORD_RIGHT': {
      const target = findWordBoundaryRight(state.text, state.cursor)
      return withDesiredCol(state, state.text, target)
    }

    case 'MOVE_TO_LINE_START': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      const lineStartOffset = offsetFromPosition(lines, pos.row, 0)
      return { text: state.text, cursor: lineStartOffset, desiredCol: 0 }
    }

    case 'MOVE_TO_LINE_END': {
      const lines = state.text.split(`\n`)
      const pos = positionFromOffset(state.text, state.cursor)
      const lineEndCol = lines[pos.row].length
      const lineEndOffset = offsetFromPosition(lines, pos.row, lineEndCol)
      return { text: state.text, cursor: lineEndOffset, desiredCol: lineEndCol }
    }

    case 'SET_TEXT': {
      const newCursor = action.text.length
      return withDesiredCol(state, action.text, newCursor)
    }

    case 'CLEAR':
      return initialState
  }
}

type TEditorState = {
  text: string
  cursor: number
  lines: string[]
  cursorRow: number
  cursorCol: number
  dispatch: (action: TEditorAction) => void
  insert: (chars: string) => void
  deleteBackward: () => void
  deleteForward: () => void
  deleteWordBackward: () => void
  killToEnd: () => void
  killToStart: () => void
  moveLeft: () => void
  moveRight: () => void
  moveUp: () => void
  moveDown: () => void
  moveToLineStart: () => void
  moveToLineEnd: () => void
  moveWordLeft: () => void
  moveWordRight: () => void
  setText: (text: string) => void
  clear: () => void
}

export function useEditorState(): TEditorState {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  const lines = useMemo(() => state.text.split(`\n`), [state.text])
  const { row: cursorRow, col: cursorCol } = useMemo(
    () => positionFromOffset(state.text, state.cursor),
    [state.text, state.cursor]
  )

  // All callbacks are stable — dispatch identity never changes
  const insert = useCallback((chars: string) => dispatch({ type: 'INSERT', chars }), [])
  const deleteBackward = useCallback(() => dispatch({ type: 'DELETE_BACKWARD' }), [])
  const deleteForward = useCallback(() => dispatch({ type: 'DELETE_FORWARD' }), [])
  const deleteWordBackward = useCallback(
    () => dispatch({ type: 'DELETE_WORD_BACKWARD' }),
    []
  )
  const killToEnd = useCallback(() => dispatch({ type: 'KILL_TO_END' }), [])
  const killToStart = useCallback(() => dispatch({ type: 'KILL_TO_START' }), [])
  const moveLeft = useCallback(() => dispatch({ type: 'MOVE_LEFT' }), [])
  const moveRight = useCallback(() => dispatch({ type: 'MOVE_RIGHT' }), [])
  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), [])
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), [])
  const moveToLineStart = useCallback(() => dispatch({ type: 'MOVE_TO_LINE_START' }), [])
  const moveToLineEnd = useCallback(() => dispatch({ type: 'MOVE_TO_LINE_END' }), [])
  const moveWordLeft = useCallback(() => dispatch({ type: 'MOVE_WORD_LEFT' }), [])
  const moveWordRight = useCallback(() => dispatch({ type: 'MOVE_WORD_RIGHT' }), [])
  const setText = useCallback((text: string) => dispatch({ type: 'SET_TEXT', text }), [])
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  return {
    text: state.text,
    cursor: state.cursor,
    lines,
    cursorRow,
    cursorCol,
    dispatch,
    insert,
    deleteBackward,
    deleteForward,
    deleteWordBackward,
    killToEnd,
    killToStart,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    moveToLineStart,
    moveToLineEnd,
    moveWordLeft,
    moveWordRight,
    setText,
    clear,
  }
}
