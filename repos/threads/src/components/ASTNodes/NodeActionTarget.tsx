import type { TActionTarget } from '@TTH/ast'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { NodeSpan } from './NodeSpan'

export function NodeActionTarget({ node }: { node: TActionTarget }) {
  return (
    <Button
      size='small'
      variant={node.focused ? `contained` : `outlined`}
      sx={{
        fontFamily: `monospace`,
        textTransform: `none`,
        display: `inline-flex`,
        alignItems: `center`,
        gap: 0.5,
        px: 1,
        py: 0.25,
      }}
    >
      <Box
        component='span'
        sx={{ display: `inline-flex` }}
      >
        {node.children.length > 0
          ? node.children.map((span, i) => (
              <NodeSpan
                key={i}
                node={span}
              />
            ))
          : node.label}
      </Box>
      {node.hotkey && (
        <Typography
          component='span'
          variant='caption'
          sx={{
            fontFamily: `monospace`,
            opacity: 0.7,
            ml: 0.5,
          }}
        >
          [{node.hotkey}]
        </Typography>
      )}
    </Button>
  )
}
