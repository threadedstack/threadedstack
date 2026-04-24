import type { TDiffBlock } from '@TTH/types/ast.types'
import Box from '@mui/material/Box'
import { NodeTextLine } from './NodeTextLine'

function getDiffLineStyle(text: string): React.CSSProperties {
  const firstChar = text.charAt(0)
  if (firstChar === `+`) {
    return { backgroundColor: `rgba(0, 200, 100, 0.12)` }
  }
  if (firstChar === `-`) {
    return { backgroundColor: `rgba(220, 50, 50, 0.12)` }
  }
  return {}
}

export const NodeDiffBlock = ({ node }: { node: TDiffBlock }) => {
  return (
    <Box
      sx={{
        fontFamily: `monospace`,
        whiteSpace: `pre`,
        my: 0.5,
        overflow: `auto`,
      }}
    >
      {node.children.map((line, i) => {
        const rawText = line.children.map((s) => s.text).join(``)
        const lineStyle = getDiffLineStyle(rawText)
        return (
          <Box
            key={i}
            component='div'
            style={lineStyle}
          >
            <NodeTextLine node={line} />
          </Box>
        )
      })}
    </Box>
  )
}
