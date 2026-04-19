import { useAtomValue } from 'jotai'
import { Box } from '@mui/material'
import { sessionASTAtom } from '@TTH/state/gui'
import { useActivityFeed } from '@TTH/hooks/useActivityFeed'
import { renderDocument } from '@TTH/visitors'
import { ActivityFeed } from '@TTH/components/ActivityFeed/ActivityFeed'

export type TSessionGUIViewProps = {
  sessionId: string
  onRespond?: (answer: string) => void
}

export const SessionGUIView = (props: TSessionGUIViewProps) => {
  const { sessionId, onRespond } = props
  const astMap = useAtomValue(sessionASTAtom)
  const { events, mode } = useActivityFeed(sessionId)
  const doc = astMap.get(sessionId)

  if (mode === `tui` && doc) {
    return (
      <Box
        sx={{
          flex: 1,
          width: `100%`,
          height: `100%`,
          overflow: `hidden`,
          fontFamily: `monospace`,
        }}
      >
        {renderDocument(doc)}
      </Box>
    )
  }

  if (events.length > 0) {
    return (
      <ActivityFeed
        events={events}
        onRespond={onRespond}
      />
    )
  }

  if (doc) {
    return (
      <Box
        sx={{
          flex: 1,
          width: `100%`,
          height: `100%`,
          overflow: `auto`,
          fontFamily: `monospace`,
        }}
      >
        {renderDocument(doc)}
      </Box>
    )
  }

  return (
    <ActivityFeed
      events={events}
      onRespond={onRespond}
    />
  )
}
