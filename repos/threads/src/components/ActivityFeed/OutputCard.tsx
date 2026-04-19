import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import type { TFeedEvent } from '@TTH/ast'
import { NodeTextLine } from '@TTH/components/ASTNodes/NodeTextLine'

type TOutputEvent = Extract<TFeedEvent, { kind: 'output' }>

export type TOutputCardProps = {
  event: TOutputEvent
}

const STATUS_COLORS: Record<TOutputEvent['status'], string> = {
  streaming: `#a855f7`,
  complete: `#6b7280`,
}

export const OutputCard = (props: TOutputCardProps) => {
  const { event } = props
  const [collapsed, setCollapsed] = useState(event.collapsed)
  const color = STATUS_COLORS[event.status]
  const lineCount = event.lines.length

  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        borderRadius: 1,
        border: `1px solid`,
        borderColor: `divider`,
        overflow: `hidden`,
      }}
    >
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: 1,
          px: 1,
          py: 0.5,
          cursor: `pointer`,
          backgroundColor: `action.hover`,
          '&:hover': { backgroundColor: `action.selected` },
        }}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <FiberManualRecordIcon sx={{ fontSize: 10, color, flexShrink: 0 }} />
        <Typography
          variant='caption'
          sx={{ color: `text.secondary`, fontFamily: `monospace` }}
        >
          {event.summary || `${lineCount} line${lineCount !== 1 ? `s` : ``}`}
        </Typography>
        <Typography
          variant='caption'
          sx={{ ml: `auto`, color: `text.disabled` }}
        >
          {collapsed ? `▶` : `▼`}
        </Typography>
      </Box>

      <Collapse in={!collapsed}>
        <Box
          sx={{
            p: 1,
            overflowX: `auto`,
            backgroundColor: `rgba(0,0,0,0.15)`,
          }}
        >
          {event.lines.map((line, i) => (
            <NodeTextLine
              key={i}
              node={line}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
