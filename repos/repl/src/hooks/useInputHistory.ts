import { useState, useCallback } from 'react'

export function useInputHistory(maxSize = 100) {
  const [history, setHistory] = useState<string[]>([])
  const [index, setIndex] = useState(-1)

  const add = useCallback(
    (entry: string) => {
      setHistory((prev) => {
        const next = [...prev, entry]
        return next.length > maxSize ? next.slice(-maxSize) : next
      })
      setIndex(-1)
    },
    [maxSize]
  )

  const up = useCallback((): string | null => {
    if (history.length === 0) return null
    const nextIndex = index === -1 ? history.length - 1 : Math.max(0, index - 1)
    setIndex(nextIndex)
    return history[nextIndex]
  }, [history, index])

  const down = useCallback((): string | null => {
    if (index === -1) return null
    const nextIndex = index + 1
    if (nextIndex >= history.length) {
      setIndex(-1)
      return ''
    }
    setIndex(nextIndex)
    return history[nextIndex]
  }, [history, index])

  const reset = useCallback(() => setIndex(-1), [])

  return { add, up, down, reset, history }
}
