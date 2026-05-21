import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import { useTheme, useMediaQuery } from '@mui/material'
import { useContextPanelOpen } from '@TTH/state/selectors'
import { ContextPanelWidth } from '@TTH/constants/values'

export type TSessionLayout = {
  header: ReactNode
  terminal: ReactNode
  contextPanel: ReactNode
  editor?: ReactNode
}

export const SessionLayout = (props: TSessionLayout) => {
  const { header, terminal, contextPanel, editor } = props
  const theme = useTheme()
  const [contextPanelOpen] = useContextPanelOpen()
  const isCompact = useMediaQuery(theme.breakpoints.down(`lg`))
  const showContextPanel = contextPanelOpen && !isCompact
  const hasEditor = !!editor
  const lastRow = hasEditor ? 4 : 3

  return (
    <Box
      sx={{
        width: `100%`,
        height: `100%`,
        display: `grid`,
        overflow: `hidden`,
        gridTemplateRows: hasEditor ? `auto minmax(220px, 36vh) 1fr` : `auto 1fr`,
        gridTemplateColumns: showContextPanel ? `1fr ${ContextPanelWidth}px` : `1fr`,
      }}
    >
      <Box
        sx={{
          gridColumn: `1 / 2`,
          gridRow: `1 / 2`,
          minWidth: 0,
        }}
      >
        {header}
      </Box>
      {hasEditor && (
        <Box
          sx={{
            gridColumn: `1 / 2`,
            gridRow: `2 / 3`,
            minHeight: 0,
            minWidth: 0,
            display: `flex`,
            flexDirection: `column`,
            overflow: `hidden`,
          }}
        >
          {editor}
        </Box>
      )}
      <Box
        sx={{
          gridColumn: `1 / 2`,
          gridRow: hasEditor ? `3 / 4` : `2 / 3`,
          minHeight: 0,
          minWidth: 0,
          display: `flex`,
          flexDirection: `column`,
          overflow: `hidden`,
        }}
      >
        {terminal}
      </Box>
      {showContextPanel && (
        <Box
          sx={{
            gridColumn: `2 / 3`,
            gridRow: `1 / ${lastRow}`,
            minHeight: 0,
            overflowY: `auto`,
            borderLeft: 1,
            borderColor: `divider`,
          }}
        >
          {contextPanel}
        </Box>
      )}
    </Box>
  )
}
