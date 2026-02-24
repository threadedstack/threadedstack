import type { TMsgType, TWSServerMsg } from '@tdsk/domain'

import { EMsgType, EWSEventType } from '@tdsk/domain'
import { AgentWSService } from '@TAF/services/agentWSService'
import { useState, useRef, useCallback, useEffect } from 'react'

export type TChatMessage = {
  id: string
  text: string
  role: TMsgType
  timestamp: number
  toolCalls?: TChatToolCall[]
}

export type TChatToolCall = {
  id: string
  name: string
  args: string
  result?: string
  isError?: boolean
}

export type TTokenUsage = {
  input: number
  total: number
  output: number
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
  const [usage, setUsage] = useState<TTokenUsage>({ input: 0, output: 0, total: 0 })

  // Refs for values that must be current inside WS callbacks
  const isStreamingRef = useRef(false)
  const threadIdRef = useRef(opts.threadId)
  const activeMsgIdRef = useRef<string | null>(null)
  const toolCallsRef = useRef<Map<string, TChatToolCall>>(new Map())
  const serviceRef = useRef<AgentWSService | null>(null)

  // Keep threadId ref in sync with state
  threadIdRef.current = threadId

  /**
   * Process an incoming WS event from the backend.
   * Uses refs for message ID and tool call tracking so the function
   * identity is stable and doesn't need to be in any dependency arrays.
   */
  const processWSEvent = useCallback((msg: TWSServerMsg) => {
    const msgId = activeMsgIdRef.current
    if (!msgId) return

    switch (msg.type) {
      case EWSEventType.TextDelta:
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: m.text + msg.delta } : m))
        )
        break

      case EWSEventType.ToolExecutionStart: {
        const tc: TChatToolCall = {
          id: msg.toolCallId,
          name: msg.toolName,
          args: ``,
        }
        toolCallsRef.current.set(tc.id, tc)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, toolCalls: [...(m.toolCalls || []), tc] } : m
          )
        )
        break
      }

      case EWSEventType.ToolExecutionUpdate:
      case EWSEventType.ToolExecutionEnd: {
        const toolCallId = msg.toolCallId
        const tc = toolCallsRef.current.get(toolCallId)
        if (tc) {
          tc.result = msg.result
          tc.isError = msg.isError ?? false
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((t) =>
                      t.id === toolCallId ? { ...tc } : t
                    ),
                  }
                : m
            )
          )
        }
        break
      }

      case EWSEventType.ThreadCreated:
        setThreadId(msg.threadId)
        break

      case EWSEventType.TurnEnd: {
        const u = msg.usage
        setUsage((prev) => ({
          input: prev.input + u.input,
          output: prev.output + u.output,
          total: prev.total + u.input + u.output,
        }))
        break
      }

      case EWSEventType.Error:
        setError(msg.message)
        break

      case EWSEventType.Done:
        activeMsgIdRef.current = null
        isStreamingRef.current = false
        setIsStreaming(false)
        break
    }
  }, [])

  // Initialize WS service — recreated when orgId or agentId changes
  useEffect(() => {
    const service = new AgentWSService({ orgId, agentId })
    serviceRef.current = service

    service.setCallbacks({
      onEvent: processWSEvent,
      onStateChange: () => {},
      onError: (message: string) => setError(message),
    })

    return () => {
      service.dispose()
      serviceRef.current = null
    }
  }, [orgId, agentId, processWSEvent])

  const sendMessage = useCallback(
    async (prompt: string) => {
      // Use ref for guard — synchronous, no race condition
      if (isStreamingRef.current || !prompt.trim()) return

      isStreamingRef.current = true
      setIsStreaming(true)
      setError(undefined)

      const ts = Date.now()
      const userMsg: TChatMessage = {
        id: `${EMsgType.user}-${ts}`,
        text: prompt,
        role: EMsgType.user,
        timestamp: ts,
      }

      const assistantMsgId = `${EMsgType.assistant}-${ts}`
      const assistantMsg: TChatMessage = {
        id: assistantMsgId,
        text: ``,
        toolCalls: [],
        role: EMsgType.assistant,
        timestamp: ts,
      }

      activeMsgIdRef.current = assistantMsgId
      toolCallsRef.current = new Map()
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      try {
        const service = serviceRef.current
        if (!service) throw new Error(`WS service not initialized`)

        const connected = await service.ensureConnection()
        if (!connected) {
          setError(`Failed to connect to agent`)
          isStreamingRef.current = false
          setIsStreaming(false)
          return
        }

        service.send({
          type: EWSEventType.Prompt,
          prompt,
          threadId: threadIdRef.current,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : `Connection error`)
        isStreamingRef.current = false
        setIsStreaming(false)
      }
    },
    [orgId, agentId]
  )

  const cancel = useCallback(() => {
    if (!isStreamingRef.current) return
    serviceRef.current?.send({ type: EWSEventType.Cancel })
  }, [])

  const reset = useCallback(() => {
    if (isStreamingRef.current) {
      serviceRef.current?.send({ type: EWSEventType.Cancel })
    }

    serviceRef.current?.close()

    setMessages([])
    setThreadId(undefined)
    setError(undefined)
    setUsage({ input: 0, output: 0, total: 0 })
    toolCallsRef.current = new Map()
    activeMsgIdRef.current = null
    isStreamingRef.current = false
    setIsStreaming(false)
  }, [])

  return {
    error,
    reset,
    usage,
    cancel,
    messages,
    threadId,
    isStreaming,
    sendMessage,
  }
}
