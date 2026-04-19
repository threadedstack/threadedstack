import type { TGroup } from '@TTH/ast'
import Box from '@mui/material/Box'
import { renderNode } from '@TTH/visitors/renderVisitor'

export function NodeGroup({ node }: { node: TGroup }) {
  return (
    <Box sx={{ fontFamily: `monospace` }}>
      {node.children.map((child, i) => renderNode(child, i))}
    </Box>
  )
}
