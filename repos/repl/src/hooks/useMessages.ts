import { useState, useCallback } from 'react'

type TDisplayMessage = {
  type: string
  content: string
}

export function useMessages() {
  const [messages, setMessages] = useState<TDisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [toolCalls, setToolCalls] = useState<any[]>([])

  const addMessage = useCallback((msg: TDisplayMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const clearStream = useCallback(() => {
    setStreamText('')
    setToolCalls([])
  }, [])

  return {
    messages,
    addMessage,
    setMessages,
    isStreaming,
    setIsStreaming,
    streamText,
    setStreamText,
    toolCalls,
    setToolCalls,
    clearStream,
  }
}
