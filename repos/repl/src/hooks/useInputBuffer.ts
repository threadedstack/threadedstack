import type { TEditorAction } from '@TRL/hooks/useEditorState'

import { useRef, useCallback } from 'react'

/**
 * Buffers editor actions and flushes them on the next event loop tick via setImmediate.
 * Keystrokes accumulate in a mutable ref (zero re-renders) and dispatch in a single batch.
 * This decouples keystroke capture from React rendering.
 */
export function useInputBuffer(
  dispatch: (action: TEditorAction) => void,
  onFlush?: () => void
) {
  const queue = useRef<TEditorAction[]>([])
  const scheduled = useRef(false)

  const flush = useCallback(() => {
    scheduled.current = false
    const actions = queue.current.splice(0)
    if (!actions.length) return
    for (const action of actions) dispatch(action)
    onFlush?.()
  }, [dispatch, onFlush])

  const buffer = useCallback(
    (action: TEditorAction) => {
      queue.current.push(action)
      if (!scheduled.current) {
        scheduled.current = true
        setImmediate(flush)
      }
    },
    [flush]
  )

  return buffer
}
