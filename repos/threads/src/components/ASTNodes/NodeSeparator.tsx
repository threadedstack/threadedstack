import type { TSeparator } from '@TTH/ast'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'

export function NodeSeparator({ node }: { node: TSeparator }) {
  if (node.style === `blank`) {
    return <Box sx={{ height: `1em` }} />
  }

  if (node.style === `dashed`) {
    return (
      <Box
        sx={{
          borderBottom: `1px dashed`,
          borderColor: `divider`,
          my: 0.5,
        }}
      />
    )
  }

  // style === 'line'
  return <Divider sx={{ my: 0.5 }} />
}
