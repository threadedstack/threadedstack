import { Business } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'

export const EmptyState = () => (
  <Box
    sx={{
      py: 8,
      gap: 2,
      display: `flex`,
      alignItems: `center`,
      flexDirection: `column`,
      justifyContent: `center`,
    }}
  >
    <Business sx={{ fontSize: 48, color: `text.disabled` }} />
    <Typography
      variant='body1'
      color='text.secondary'
    >
      No organizations found
    </Typography>
  </Box>
)
