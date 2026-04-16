import type { TParsedEvent } from '@tdsk/domain'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Box } from '@mui/material'

const remarkPlugins = [remarkGfm, remarkBreaks]

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
          '& ul, & ol': { m: 0, pl: 2.5 },
          '& li': { mb: 0.25 },
          '& li + li': { mt: 0.25 },
          '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.5, '&:first-child': { mt: 0 } },
          '& table': {
            borderCollapse: `collapse`,
            my: 1,
            '& th, & td': {
              border: `1px solid`,
              borderColor: `divider`,
              px: 1,
              py: 0.5,
              fontSize: `0.85rem`,
            },
            '& th': { backgroundColor: `action.hover`, fontWeight: 600 },
          },
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
          '& hr': {
            border: `none`,
            borderTop: `1px solid`,
            borderColor: `divider`,
            my: 1,
          },
        }}
      >
        <Markdown remarkPlugins={remarkPlugins}>{event.content}</Markdown>
      </Box>
    </Box>
  )
}
