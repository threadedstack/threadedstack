import type { TStreamEvent } from '@tdsk/domain'

import { useState, useRef, useCallback } from 'react'
import { agentsApi } from '@TAF/services/agentsApi'
import { EStreamEventType } from '@tdsk/domain'

export type TChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolCalls?: TChatToolCall[]
  timestamp: number
}

export type TChatToolCall = {
  id: string
  name: string
  args: string
  result?: string
  isError?: boolean
}

export type TUseAgentChatOpts = {
  orgId: string
  agentId: string
  threadId?: string
}

export const useAgentChat = (opts: TUseAgentChatOpts) => {
  const { orgId, agentId } = opts

  const [messages, setMessages] = useState<TChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [threadId, setThreadId] = useState<string | undefined>(opts.threadId)
  const [error, setError] = useState<string | undefined>()

  const abortRef = useRef<AbortController | null>(null)
  const toolCallsRef = useRef<Map<string, TChatToolCall>>(new Map())

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (isStreaming || !prompt.trim()) return

      setError(undefined)
      setIsStreaming(true)

      const userMsg: TChatMessage = {
        id: `user-${Date.now()}`,
        role: `user`,
        text: prompt,
        timestamp: Date.now(),
      }

      const assistantMsg: TChatMessage = {
        id: `assistant-${Date.now()}`,
        role: `assistant`,
        text: ``,
        toolCalls: [],
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      toolCallsRef.current = new Map()

      try {
        const { response, error: fetchErr } = await agentsApi.run(
          orgId,
          agentId,
          prompt,
          threadId
        )

        if (fetchErr || !response) {
          setError(fetchErr?.message || `Failed to start agent`)
          setIsStreaming(false)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          setError(`No response stream`)
          setIsStreaming(false)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ``

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split(`\n`)
          buffer = lines.pop() || ``

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith(`data: `)) continue

            const data = trimmed.slice(6)
            if (data === `[DONE]`) continue

            try {
              const event = JSON.parse(data)

              if (event.type === `thread` && event.threadId) {
                setThreadId(event.threadId)
                continue
              }

              processEvent(event as TStreamEvent, assistantMsg.id)
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Stream error`)
      } finally {
        setIsStreaming(false)
      }
    },
    [orgId, agentId, threadId, isStreaming]
  )

  const processEvent = (event: TStreamEvent, msgId: string) => {
    switch (event.type) {
      case EStreamEventType.text:
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: m.text + event.text } : m))
        )
        break

      case EStreamEventType.toolCallStart: {
        const tc: TChatToolCall = { id: event.id, name: event.name, args: `` }
        toolCallsRef.current.set(event.id, tc)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, toolCalls: [...(m.toolCalls || []), tc] } : m
          )
        )
        break
      }

      case EStreamEventType.toolCallArgs: {
        const existing = toolCallsRef.current.get(event.id)
        if (existing) {
          existing.args += event.args
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((tc) =>
                      tc.id === event.id ? { ...existing } : tc
                    ),
                  }
                : m
            )
          )
        }
        break
      }

      case EStreamEventType.toolResult: {
        const tc = toolCallsRef.current.get(event.toolUseId)
        if (tc) {
          tc.result = event.content
          tc.isError = event.isError
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((t) =>
                      t.id === event.toolUseId ? { ...tc } : t
                    ),
                  }
                : m
            )
          )
        }
        break
      }

      case EStreamEventType.error:
        setError(event.error)
        break
    }
  }

  const reset = useCallback(() => {
    setMessages([])
    setThreadId(undefined)
    setError(undefined)
    toolCallsRef.current = new Map()
  }, [])

  return {
    messages,
    sendMessage,
    isStreaming,
    threadId,
    error,
    reset,
  }
}
