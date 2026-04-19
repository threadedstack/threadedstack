import type { TConfirm } from '@TTH/ast'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

export function NodeConfirm({ node }: { node: TConfirm }) {
  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        gap: 1,
        p: 1,
        fontFamily: `monospace`,
      }}
    >
      <Typography
        variant='body2'
        sx={{ fontFamily: `monospace` }}
      >
        {node.question}
      </Typography>
      <Box sx={{ display: `flex`, gap: 1 }}>
        {node.options.map((option, i) => (
          <Button
            key={i}
            size='small'
            variant={node.focusedIndex === i ? `contained` : `outlined`}
            sx={{ fontFamily: `monospace`, textTransform: `none` }}
          >
            {option}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
