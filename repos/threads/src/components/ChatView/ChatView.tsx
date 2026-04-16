import type { TParsedEvent, TJsonComponentTree, TInteraction } from '@tdsk/domain'

import type React from 'react'
import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import { useSessionEvents, useSessionUpgrades, useUser } from '@TTH/state/selectors'
import { Box, Chip, Divider } from '@mui/material'
import { toast } from 'sonner'
import { GenerativeUIRenderer } from './GenerativeUIRenderer'
import { sendControl } from '@TTH/actions/sessions/sendInput'

import { UserBubble } from './UserBubble'
import { AiBubble } from './AiBubble'
import { ToolCallCard } from './ToolCallCard'
import { PermissionCard } from './PermissionCard'
import { DiffCard } from './DiffCard'
import { ErrorCard } from './ErrorCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import { UnknownBlock } from './UnknownBlock'

export type TChatView = {
  sessionId: string
  readOnly?: boolean
}

type TEventWithChunk = TParsedEvent & { chunkId?: string }

const EventRenderer = (props: {
  event: TParsedEvent
  sessionId: string
  currentUserId: string
  readOnly?: boolean
}) => {
  const { event, sessionId, currentUserId, readOnly } = props

  switch (event.type) {
    case `input`:
      return (
        <UserBubble
          event={event}
          isOwnInput={event.userId === currentUserId}
        />
      )
    case `text`:
      return <AiBubble event={event} />
    case `tool-call`:
      return <ToolCallCard event={event} />
    case `permission`:
      return (
        <PermissionCard
          event={event}
          sessionId={sessionId}
          readOnly={readOnly}
        />
      )
    case `diff`:
      return <DiffCard event={event} />
    case `error`:
      return <ErrorCard event={event} />
    case `activity`:
      return <ThinkingIndicator event={event} />
    case `unknown`:
      return <UnknownBlock event={event} />
    case `prompt-ready`:
      return null
    default:
      return null
  }
}

/**
 * Render a group of events that share a chunkId as a single merged bubble.
 * Text events are combined into one AiBubble with joined content.
 * Non-text events render individually within the group.
 */
function renderChunkGroup(
  events: TEventWithChunk[],
  sessionId: string,
  currentUserId: string,
  readOnly?: boolean
) {
  const textParts: string[] = []
  const nonTextElements: React.ReactNode[] = []

  for (let i = 0; i < events.length; i++) {
    const evt = events[i]
    if (evt.type === 'text') {
      textParts.push((evt as Extract<TParsedEvent, { type: 'text' }>).content)
    } else if (evt.type !== 'activity' && evt.type !== 'prompt-ready') {
      nonTextElements.push(
        <EventRenderer
          key={`chunk-evt-${i}`}
          event={evt}
          sessionId={sessionId}
          currentUserId={currentUserId}
          readOnly={readOnly}
        />
      )
    }
  }

  const elements: React.ReactNode[] = []

  if (textParts.length > 0) {
    const merged: TParsedEvent = {
      type: 'text',
      content: textParts.join('\n\n'),
      timestamp: events[0]?.timestamp ?? Date.now(),
    }
    elements.push(
      <AiBubble
        key='merged-text'
        event={merged as Extract<TParsedEvent, { type: 'text' }>}
      />
    )
  }

  elements.push(...nonTextElements)
  return elements
}

/**
 * Check if an unknown event has meaningful content worth rendering.
 * Suppresses chrome fragments that slipped through the parser filter.
 */
function isSubstantialUnknown(
  event: Extract<TParsedEvent, { type: 'unknown' }>
): boolean {
  const raw = event.raw.trim()
  if (raw.length < 3) return false
  // Only whitespace, pipes, or box-drawing chars
  if (/^[\s│|─┌┐└┘┬┴├┤═\-]+$/.test(raw)) return false
  return true
}

function renderEvents(
  events: TEventWithChunk[],
  upgrades: Map<string, TJsonComponentTree>,
  handleGuiAction: (interaction: TInteraction) => void,
  toggleShowRaw: (chunkId: string) => void,
  showRawChunks: Set<string>,
  sessionId: string,
  currentUserId: string,
  readOnly?: boolean
) {
  const rendered: React.ReactNode[] = []
  const processedChunks = new Set<string>()
  let lastRenderedType: string | null = null

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const chunkId = (event as any).chunkId as string | undefined

    // Events with a chunkId — group and potentially upgrade
    if (chunkId) {
      if (processedChunks.has(chunkId)) continue
      processedChunks.add(chunkId)

      const chunkEvents = events.filter((e) => (e as any).chunkId === chunkId)

      // Has upgrade → render interactive UI or raw toggle
      if (upgrades.has(chunkId)) {
        if (showRawChunks.has(chunkId)) {
          rendered.push(
            <Box key={`raw-${chunkId}`}>
              {renderChunkGroup(chunkEvents, sessionId, currentUserId, readOnly)}
              <ToggleButton
                onClick={() => toggleShowRaw(chunkId)}
                label='Show Interactive'
              />
            </Box>
          )
        } else {
          rendered.push(
            <Box
              key={`gui-${chunkId}`}
              className='fade-swap'
            >
              <Chip
                label='Interactive'
                size='small'
                color='primary'
                variant='outlined'
                sx={{ mb: 0.5, height: 20, fontSize: 11 }}
              />
              <GenerativeUIRenderer
                tree={upgrades.get(chunkId)!}
                onAction={handleGuiAction}
              />
              <ToggleButton
                onClick={() => toggleShowRaw(chunkId)}
                label='Show Raw'
              />
            </Box>
          )
        }
        lastRenderedType = 'gui'
        continue
      }

      // No upgrade — render as merged group (single bubble instead of per-line)
      rendered.push(
        <Box key={`chunk-${chunkId}`}>
          {renderChunkGroup(chunkEvents, sessionId, currentUserId, readOnly)}
        </Box>
      )
      lastRenderedType = 'chunk'
      continue
    }

    // ── Bypass events (no chunkId) ────────────────────────────────

    // Activity coalescing: skip if the last rendered element was also activity
    if (event.type === 'activity') {
      if (lastRenderedType === 'activity') continue
      lastRenderedType = 'activity'
      rendered.push(
        <EventRenderer
          key={`evt-activity-${event.timestamp}-${i}`}
          event={event}
          sessionId={sessionId}
          currentUserId={currentUserId}
          readOnly={readOnly}
        />
      )
      continue
    }

    // Unknown block filtering: suppress chrome fragments
    if (event.type === 'unknown') {
      if (!isSubstantialUnknown(event as Extract<TParsedEvent, { type: 'unknown' }>))
        continue
    }

    // Prompt-ready renders as a subtle divider
    if (event.type === 'prompt-ready') {
      rendered.push(
        <Divider
          key={`divider-${event.timestamp}-${i}`}
          sx={{ my: 0.5, borderColor: 'divider', opacity: 0.3 }}
        />
      )
      lastRenderedType = 'prompt-ready'
      continue
    }

    // Text accumulation: merge consecutive non-chunked text events
    if (event.type === 'text') {
      const textParts: string[] = [
        (event as Extract<TParsedEvent, { type: 'text' }>).content,
      ]
      while (
        i + 1 < events.length &&
        events[i + 1].type === 'text' &&
        !(events[i + 1] as any).chunkId
      ) {
        i++
        textParts.push((events[i] as Extract<TParsedEvent, { type: 'text' }>).content)
      }
      const merged: TParsedEvent = {
        type: 'text',
        content: textParts.join('\n\n'),
        timestamp: event.timestamp,
      }
      rendered.push(
        <AiBubble
          key={`evt-text-merged-${event.timestamp}-${i}`}
          event={merged as Extract<TParsedEvent, { type: 'text' }>}
        />
      )
      lastRenderedType = 'text'
      continue
    }

    // All other bypass events render individually
    rendered.push(
      <EventRenderer
        key={`evt-${event.type}-${event.timestamp}-${i}`}
        event={event}
        sessionId={sessionId}
        currentUserId={currentUserId}
        readOnly={readOnly}
      />
    )
    lastRenderedType = event.type
  }

  return rendered
}

function ToggleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Box
      component='button'
      onClick={onClick}
      sx={{
        fontSize: 11,
        color: 'text.secondary',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        p: 0,
        mt: 0.5,
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {label}
    </Box>
  )
}

export const ChatView = (props: TChatView) => {
  const { sessionId, readOnly } = props
  const events = useSessionEvents(sessionId)
  const [user] = useUser()
  const currentUserId = user?.id ?? ``
  const upgrades = useSessionUpgrades(sessionId)
  const [showRawChunks, setShowRawChunks] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleGuiAction = useCallback(
    (interaction: TInteraction) => {
      if (!sendControl(sessionId, { type: 'gui-interaction', interaction })) {
        toast.error('Could not send interaction', { description: 'Session disconnected' })
      }
    },
    [sessionId]
  )

  const toggleShowRaw = useCallback((chunkId: string) => {
    setShowRawChunks((prev) => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }, [])

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: `smooth` })
  }, [events.length])

  return (
    <Box
      sx={{
        flex: 1,
        overflow: `auto`,
        display: `flex`,
        flexDirection: `column`,
        gap: 1.5,
        p: 2,
      }}
    >
      <style>{`
        @keyframes fadeSwap {
          0% { opacity: 0.4; filter: blur(2px); }
          100% { opacity: 1; filter: blur(0); }
        }
        .fade-swap { animation: fadeSwap 0.35s ease-out forwards; }
      `}</style>
      {renderEvents(
        events,
        upgrades,
        handleGuiAction,
        toggleShowRaw,
        showRawChunks,
        sessionId,
        currentUserId,
        readOnly
      )}
      <div ref={bottomRef} />
    </Box>
  )
}
