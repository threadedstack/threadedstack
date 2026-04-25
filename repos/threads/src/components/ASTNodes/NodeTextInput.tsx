import type { TTextInput } from '@TTH/types/ast.types'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

export const NodeTextInput = ({ node }: { node: TTextInput }) => {
  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: 1,
        p: 0.5,
        fontFamily: `monospace`,
      }}
    >
      {node.prompt && (
        <Typography
          variant='body2'
          sx={{ fontFamily: `monospace`, whiteSpace: `pre`, flexShrink: 0 }}
        >
          {node.prompt}
        </Typography>
      )}
      <TextField
        value={node.value}
        slotProps={{ input: { readOnly: true } }}
        size='small'
        variant='outlined'
        placeholder={node.suggestion}
        sx={{
          flex: 1,
          '& .MuiInputBase-input': {
            fontFamily: `monospace`,
            fontSize: `0.875rem`,
            py: 0.5,
          },
        }}
      />
    </Box>
  )
}
