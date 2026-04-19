import type { TStatusBar } from '@TTH/ast'
import Box from '@mui/material/Box'
import { NodeSpan } from './NodeSpan'

export function NodeStatusBar({ node }: { node: TStatusBar }) {
  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `row`,
        flexWrap: `nowrap`,
        fontFamily: `monospace`,
        whiteSpace: `pre`,
        overflow: `hidden`,
      }}
    >
      {node.segments.map((segment, i) => (
        <Box
          key={i}
          component='span'
          sx={{ display: `inline-flex`, flexShrink: 0 }}
        >
          {segment.map((span, j) => (
            <NodeSpan
              key={j}
              node={span}
            />
          ))}
        </Box>
      ))}
    </Box>
  )
}
