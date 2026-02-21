import { useState, useCallback } from 'react'

export type TDisplayMessage = {
  id: string
  type: string
  content: string
}

let msgCounter = 0
const nextId = () => `msg-${++msgCounter}`

export function useMessages() {
  const [messages, setMessages] = useState<TDisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [toolCalls, setToolCalls] = useState<any[]>([])

  const addMessage = useCallback((msg: Omit<TDisplayMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId() }])
  }, [])

  const clearStream = useCallback(() => {
    setStreamText('')
    setToolCalls([])
  }, [])

  return {
    messages,
    toolCalls,
    addMessage,
    streamText,
    setMessages,
    isStreaming,
    clearStream,
    setToolCalls,
    setStreamText,
    setIsStreaming,
  }
}
