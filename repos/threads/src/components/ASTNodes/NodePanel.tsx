import type { TPanel } from '@TTH/types/ast.types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// renderNode is imported lazily via the visitor to avoid circular deps
// Components that need recursive rendering use a render prop pattern via
// the visitors/renderVisitor module.
import { renderNode } from '@TTH/visitors/renderVisitor'

const borderStyle: Record<TPanel['border'], string> = {
  single: `1px solid`,
  double: `3px double`,
  heavy: `2px solid`,
  rounded: `1px solid`,
}

const borderRadius: Record<TPanel['border'], string | number> = {
  single: 0,
  double: 0,
  heavy: 0,
  rounded: 1,
}

export const NodePanel = ({ node }: { node: TPanel }) => {
  return (
    <Box
      sx={{
        border: borderStyle[node.border],
        borderColor: `divider`,
        borderRadius: borderRadius[node.border],
        p: 1,
        my: 0.5,
        fontFamily: `monospace`,
        position: `relative`,
      }}
    >
      {node.title && (
        <Typography
          variant='caption'
          sx={{
            position: `absolute`,
            top: -10,
            left: 8,
            px: 0.5,
            bgcolor: `background.paper`,
            fontFamily: `monospace`,
            lineHeight: 1,
          }}
        >
          {node.title}
        </Typography>
      )}
      {node.children.map((child, i) => renderNode(child, i))}
    </Box>
  )
}
