import { Box } from '@mui/material'
import { useCallback, useMemo } from 'react'
import { useGuiAst } from '@TTH/state/selectors'
import { sendInput } from '@TTH/actions/sessions/sendInput'
import { renderDocument } from '@TTH/services/gui/visitors'
import { useActivityFeed } from '@TTH/hooks/activity/useActivityFeed'
import { InteractionContext } from '@TTH/contexts/InteractionContext'
import { ActivityFeed } from '@TTH/components/ActivityFeed/ActivityFeed'

export type TSessionGUIViewProps = {
  sessionId: string
  onRespond?: (answer: string) => void
}

export type TRenderGUI = {
  doc: any
  overflow: string
  interactionCtx: {
    sendKeystroke: (data: string) => boolean
  }
}

const RenderGUI = (props: TRenderGUI) => {
  const { doc, overflow, interactionCtx } = props

  return (
    <InteractionContext.Provider value={interactionCtx}>
      <Box
        sx={{
          flex: 1,
          overflow,
          width: `100%`,
          height: `100%`,
          fontFamily: `monospace`,
        }}
      >
        {renderDocument(doc!)}
      </Box>
    </InteractionContext.Provider>
  )
}

export const SessionGUIView = (props: TSessionGUIViewProps) => {
  const { sessionId, onRespond } = props
  const [astMap] = useGuiAst()
  const { events, mode } = useActivityFeed(sessionId)
  const doc = astMap.get(sessionId)

  const sendKeystroke = useCallback(
    (data: string) => sendInput(sessionId, data),
    [sessionId]
  )
  const interactionCtx = useMemo(() => ({ sendKeystroke }), [sendKeystroke])

  if (mode === `tui` && doc)
    return (
      <RenderGUI
        doc={doc}
        overflow='hidden'
        interactionCtx={interactionCtx}
      />
    )

  if (events.length > 0) {
    return (
      <ActivityFeed
        events={events}
        onRespond={onRespond}
      />
    )
  }

  if (doc)
    return (
      <RenderGUI
        doc={doc}
        overflow='auto'
        interactionCtx={interactionCtx}
      />
    )

  return (
    <ActivityFeed
      events={events}
      onRespond={onRespond}
    />
  )
}
