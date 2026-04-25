import type { TFeedEvent } from '@TTH/types'

import { Box } from '@mui/material'
import { useRef, useLayoutEffect } from 'react'
import { TUICard } from '@TTH/components/ActivityFeed/TUICard'
import { ActionCard } from '@TTH/components/ActivityFeed/ActionCard'
import { PromptCard } from '@TTH/components/ActivityFeed/PromptCard'
import { OutputCard } from '@TTH/components/ActivityFeed/OutputCard'
import { IdleMarker } from '@TTH/components/ActivityFeed/IdleMarker'
import { UserInputCard } from '@TTH/components/ActivityFeed/UserInputCard'

export type TActivityFeedProps = {
  events: TFeedEvent[]
  onRespond?: (answer: string) => void
}

const FeedEventCard = (props: {
  event: TFeedEvent
  onRespond?: (answer: string) => void
}) => {
  const { event, onRespond } = props

  switch (event.kind) {
    case `action`:
      return <ActionCard event={event} />
    case `prompt`:
      return (
        <PromptCard
          event={event}
          onRespond={onRespond}
        />
      )
    case `output`:
      return <OutputCard event={event} />
    case `tui`:
      return <TUICard event={event} />
    case `input`:
      return <UserInputCard event={event} />
    case `idle`:
      return <IdleMarker event={event} />
  }
}

export const ActivityFeed = (props: TActivityFeedProps) => {
  const { events, onRespond } = props
  const bottomRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: `smooth` })
  }, [events.length])

  return (
    <Box
      sx={{
        flex: 1,
        display: `flex`,
        flexDirection: `column`,
        overflow: `auto`,
        gap: 0.5,
        p: 1.5,
      }}
    >
      {events.map((event, idx) => (
        <FeedEventCard
          key={event.id}
          event={event}
          onRespond={onRespond}
        />
      ))}
      <div ref={bottomRef} />
    </Box>
  )
}
