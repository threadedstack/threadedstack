import type { TConfirm } from '@TTH/types/ast.types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useInteraction } from '@TTH/contexts/InteractionContext'

export const NodeConfirm = ({ node }: { node: TConfirm }) => {
  const ctx = useInteraction()

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
            onClick={() => ctx?.sendKeystroke(option.toLowerCase().charAt(0))}
          >
            {option}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
