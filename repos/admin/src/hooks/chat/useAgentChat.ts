import type { TMsgType, TWSServerMsg, TMessageContent } from '@tdsk/domain'

import { EMsgType, EWSEventType } from '@tdsk/domain'
import { threadsApi } from '@TAF/services/threadsApi'
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

  // Sync external threadId prop to internal state (e.g. when URL param changes)
  useEffect(() => {
    setThreadId(opts.threadId)
    threadIdRef.current = opts.threadId
  }, [opts.threadId])

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

  // Load existing messages when resuming a thread
  useEffect(() => {
    if (!opts.threadId || !orgId || !agentId) return

    let cancelled = false

    const loadHistory = async () => {
      const resp = await threadsApi.listMessages(orgId, agentId, opts.threadId!)
      if (cancelled || !resp.data) return

      const mapped: TChatMessage[] = resp.data.map((msg: Record<string, any>) => {
        const content: TMessageContent[] = msg.content || []

        const text = content
          .filter((c: TMessageContent) => c.type === `text`)
          .map((c: TMessageContent) => (c as { text: string }).text)
          .join(``)

        const toolCalls: TChatToolCall[] = content
          .filter((c: TMessageContent) => c.type === `tool_use`)
          .map((c: TMessageContent) => {
            const tu = c as { id: string; name: string; input: Record<string, unknown> }
            return { id: tu.id, name: tu.name, args: JSON.stringify(tu.input) }
          })

        return {
          id: msg.id,
          text,
          role: msg.type as TMsgType,
          timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        }
      })

      setMessages(mapped)
    }

    loadHistory().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : `Failed to load thread history`)
      }
    })

    return () => {
      cancelled = true
    }
  }, [opts.threadId, orgId, agentId])

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
