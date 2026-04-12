import type { TParsedEvent } from '@tdsk/domain'

import { useRef, useLayoutEffect } from 'react'
import { useSessionEvents } from '@TTH/state/selectors'
import { Box } from '@mui/material'

import { UserBubble } from './UserBubble'
import { AiBubble } from './AiBubble'
import { ToolCallCard } from './ToolCallCard'
import { PermissionCard } from './PermissionCard'
import { DiffCard } from './DiffCard'
import { ErrorCard } from './ErrorCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import { UnknownBlock } from './UnknownBlock'

export type TChatView = {
  sandboxId: string
  readOnly?: boolean
}

const EventRenderer = (props: {
  event: TParsedEvent
  sandboxId: string
  readOnly?: boolean
}) => {
  const { event, sandboxId, readOnly } = props

  switch (event.type) {
    case `input`:
      return <UserBubble event={event} />
    case `text`:
      return <AiBubble event={event} />
    case `tool-call`:
      return <ToolCallCard event={event} />
    case `permission`:
      return (
        <PermissionCard
          event={event}
          sandboxId={sandboxId}
          readOnly={readOnly}
        />
      )
    case `diff`:
      return <DiffCard event={event} />
    case `error`:
      return <ErrorCard event={event} />
    case `thinking`:
      return <ThinkingIndicator event={event} />
    case `unknown`:
      return <UnknownBlock event={event} />
    case `prompt-ready`:
      return null
    default:
      return null
  }
}

export const ChatView = (props: TChatView) => {
  const { sandboxId, readOnly } = props
  const events = useSessionEvents(sandboxId)
  const bottomRef = useRef<HTMLDivElement>(null)

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
      {events.map((event, idx) => (
        <EventRenderer
          key={`${event.type}-${event.timestamp}-${idx}`}
          event={event}
          sandboxId={sandboxId}
          readOnly={readOnly}
        />
      ))}
      <div ref={bottomRef} />
    </Box>
  )
}
