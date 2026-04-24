import type { TGroup } from '@TTH/types/ast.types'
import Box from '@mui/material/Box'
import { renderNode } from '@TTH/visitors/renderVisitor'

export const NodeGroup = ({ node }: { node: TGroup }) => {
  return (
    <Box sx={{ fontFamily: `monospace` }}>
      {node.children.map((child, i) => renderNode(child, i))}
    </Box>
  )
}
