import { useState, useCallback, useRef, useEffect } from 'react'
import type { TConnectionStatus } from '@TRL/types'

export function useConnection() {
  const [status, setStatus] = useState<TConnectionStatus>('disconnected')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    setStatus('connected')
  }, [])

  const disconnect = useCallback(() => {
    setStatus('disconnected')
  }, [])

  const reconnect = useCallback(() => {
    setStatus('reconnecting')
    reconnectTimer.current = setTimeout(() => {
      setStatus('connected')
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
    }
  }, [])

  return { status, connect, disconnect, reconnect }
}
