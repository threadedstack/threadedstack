import { TAnyCB } from '@TSC/types'
import { useEffect, useRef } from 'react'

export const useInterval = (callback: TAnyCB, delay: number | null | undefined) => {
  const intervalRef = useRef(null)
  const savedCallback = useRef(callback)

  useEffect(() => (savedCallback.current = callback), [callback])

  useEffect(() => {
    if (!delay && delay !== 0) return

    const tick = () => savedCallback.current()
    intervalRef.current = setInterval(tick, delay)

    return () => clearInterval(intervalRef.current)
  }, [delay])

  return intervalRef
}
