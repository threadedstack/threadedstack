import { TAnyCB } from '@TSC/types'
import { useEffect, useRef } from 'react'

export const useTimeout = (callback: TAnyCB, delay: number | null | undefined) => {
  const timeoutRef = useRef<NodeJS.Timeout>(null)
  const savedCallback = useRef<TAnyCB>(callback)
  useEffect(() => (savedCallback.current = callback), [callback])

  useEffect(() => {
    if (!delay && delay !== 0) return

    const tick = () => savedCallback.current()
    timeoutRef.current = setTimeout(tick, delay)

    return () => clearTimeout(timeoutRef.current)
  }, [delay])

  return timeoutRef
}
