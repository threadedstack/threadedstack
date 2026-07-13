import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import Box from '@mui/material/Box'
import DOMPurify from 'dompurify'
import convert from 'react-from-dom'
import { useMemo } from 'react'

export type TInlineDom = {
  id?: string
  html: string
  className?: string
  sx?: SxProps<Theme>
}

export const InlineDom = (props: TInlineDom) => {
  const { sx, id, html, className } = props

  // html can come from attacker-influenceable config (skills/provider/canvas
  // definitions), not just static assets -- sanitize before conversion so
  // attribute-based payloads (onerror, javascript: hrefs) never survive
  // react-from-dom, matching ArtifactRenderer's profile for the same
  // raw-HTML-string case.
  const converted = useMemo<ReactNode>(
    () =>
      convert(
        DOMPurify.sanitize(html, {
          USE_PROFILES: { html: true, svg: true, svgFilters: true },
          FORBID_TAGS: [`script`, `style`, `iframe`, `foreignObject`],
          FORBID_ATTR: [`onerror`, `onload`, `onclick`],
        })
      ) as ReactNode,
    [html]
  )

  return (
    <Box
      id={id}
      sx={sx}
      className={className}
    >
      {converted}
    </Box>
  )
}
