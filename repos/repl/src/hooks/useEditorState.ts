import { useState, useCallback, useRef, useMemo } from 'react'

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

type TEditorState = {
  text: string
  cursor: number
  lines: string[]
  cursorRow: number
  cursorCol: number
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
  const [text, setTextState] = useState(``)
  const [cursor, setCursor] = useState(0)
  const desiredColRef = useRef(0)

  const lines = useMemo(() => text.split(`\n`), [text])
  const { row: cursorRow, col: cursorCol } = useMemo(
    () => positionFromOffset(text, cursor),
    [text, cursor]
  )

  const updateDesiredCol = useCallback((col: number) => {
    desiredColRef.current = col
  }, [])

  const insert = useCallback(
    (chars: string) => {
      setTextState((prev) => prev.slice(0, cursor) + chars + prev.slice(cursor))
      setCursor((prev) => prev + chars.length)
      // After insert, update desired col
      const newText = text.slice(0, cursor) + chars + text.slice(cursor)
      const newCursor = cursor + chars.length
      const pos = positionFromOffset(newText, newCursor)
      updateDesiredCol(pos.col)
    },
    [cursor, text, updateDesiredCol]
  )

  const deleteBackward = useCallback(() => {
    if (cursor <= 0) return
    setTextState((prev) => prev.slice(0, cursor - 1) + prev.slice(cursor))
    setCursor((prev) => prev - 1)
    const newText = text.slice(0, cursor - 1) + text.slice(cursor)
    const newCursor = cursor - 1
    const pos = positionFromOffset(newText, newCursor)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const deleteForward = useCallback(() => {
    if (cursor >= text.length) return
    setTextState((prev) => prev.slice(0, cursor) + prev.slice(cursor + 1))
    // cursor stays the same
    const pos = positionFromOffset(text, cursor)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const deleteWordBackward = useCallback(() => {
    if (cursor <= 0) return
    const target = findWordBoundaryLeft(text, cursor)
    setTextState((prev) => prev.slice(0, target) + prev.slice(cursor))
    setCursor(target)
    const pos = positionFromOffset(text.slice(0, target) + text.slice(cursor), target)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const killToEnd = useCallback(() => {
    const currentLines = text.split(`\n`)
    const pos = positionFromOffset(text, cursor)
    const lineEnd = currentLines[pos.row].length

    if (pos.col === lineEnd && pos.row < currentLines.length - 1) {
      // At end of line but not last line: join with next line (delete the \n)
      const endOffset = offsetFromPosition(currentLines, pos.row, lineEnd)
      setTextState((prev) => prev.slice(0, endOffset) + prev.slice(endOffset + 1))
    } else {
      // Delete from cursor to end of current line
      const endOffset = offsetFromPosition(currentLines, pos.row, lineEnd)
      setTextState((prev) => prev.slice(0, cursor) + prev.slice(endOffset))
    }
    // cursor stays the same
  }, [cursor, text])

  const killToStart = useCallback(() => {
    const currentLines = text.split(`\n`)
    const pos = positionFromOffset(text, cursor)
    if (pos.col === 0) return
    const lineStartOffset = offsetFromPosition(currentLines, pos.row, 0)
    setTextState((prev) => prev.slice(0, lineStartOffset) + prev.slice(cursor))
    setCursor(lineStartOffset)
    updateDesiredCol(0)
  }, [cursor, text, updateDesiredCol])

  const moveLeft = useCallback(() => {
    if (cursor <= 0) return
    setCursor((prev) => prev - 1)
    const pos = positionFromOffset(text, cursor - 1)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const moveRight = useCallback(() => {
    if (cursor >= text.length) return
    setCursor((prev) => prev + 1)
    const pos = positionFromOffset(text, cursor + 1)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const moveUp = useCallback(() => {
    if (cursorRow <= 0) return
    const targetRow = cursorRow - 1
    const targetCol = Math.min(desiredColRef.current, lines[targetRow].length)
    setCursor(offsetFromPosition(lines, targetRow, targetCol))
  }, [cursorRow, lines])

  const moveDown = useCallback(() => {
    if (cursorRow >= lines.length - 1) return
    const targetRow = cursorRow + 1
    const targetCol = Math.min(desiredColRef.current, lines[targetRow].length)
    setCursor(offsetFromPosition(lines, targetRow, targetCol))
  }, [cursorRow, lines])

  const moveToLineStart = useCallback(() => {
    const lineStartOffset = offsetFromPosition(lines, cursorRow, 0)
    setCursor(lineStartOffset)
    updateDesiredCol(0)
  }, [lines, cursorRow, updateDesiredCol])

  const moveToLineEnd = useCallback(() => {
    const lineEndOffset = offsetFromPosition(lines, cursorRow, lines[cursorRow].length)
    setCursor(lineEndOffset)
    updateDesiredCol(lines[cursorRow].length)
  }, [lines, cursorRow, updateDesiredCol])

  const moveWordLeft = useCallback(() => {
    const target = findWordBoundaryLeft(text, cursor)
    setCursor(target)
    const pos = positionFromOffset(text, target)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const moveWordRight = useCallback(() => {
    const target = findWordBoundaryRight(text, cursor)
    setCursor(target)
    const pos = positionFromOffset(text, target)
    updateDesiredCol(pos.col)
  }, [cursor, text, updateDesiredCol])

  const setText = useCallback(
    (newText: string) => {
      setTextState(newText)
      setCursor(newText.length)
      const pos = positionFromOffset(newText, newText.length)
      updateDesiredCol(pos.col)
    },
    [updateDesiredCol]
  )

  const clear = useCallback(() => {
    setTextState(``)
    setCursor(0)
    updateDesiredCol(0)
  }, [updateDesiredCol])

  return {
    text,
    cursor,
    lines,
    cursorRow,
    cursorCol,
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
