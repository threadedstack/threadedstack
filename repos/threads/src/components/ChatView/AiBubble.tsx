import type { TParsedEvent } from '@tdsk/domain'

import Markdown from 'react-markdown'
import { Box } from '@mui/material'

export type TAiBubble = {
  event: Extract<TParsedEvent, { type: 'text' }>
}

export const AiBubble = (props: TAiBubble) => {
  const { event } = props

  return (
    <Box
      display='flex'
      justifyContent='flex-start'
    >
      <Box
        sx={{
          maxWidth: `85%`,
          px: 2,
          py: 1,
          borderRadius: 2,
          backgroundColor: `action.hover`,
          '& p': { m: 0 },
          '& p + p': { mt: 1 },
          '& pre': {
            backgroundColor: `grey.900`,
            color: `grey.100`,
            p: 1.5,
            borderRadius: 1,
            overflow: `auto`,
            fontFamily: `'JetBrains Mono', monospace`,
            fontSize: `0.85rem`,
          },
          '& code': {
            fontFamily: `'JetBrains Mono', monospace`,
            fontSize: `0.85rem`,
          },
        }}
      >
        <Markdown>{event.content}</Markdown>
      </Box>
    </Box>
  )
}
