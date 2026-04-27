import { Box, Typography } from '@mui/material'

export const NotFound = () => (
  <Box
    sx={{
      gap: 2,
      minHeight: 300,
      display: `flex`,
      alignItems: `center`,
      flexDirection: `column`,
      justifyContent: `center`,
    }}
  >
    <Typography
      variant='h6'
      color='text.secondary'
    >
      Project not found
    </Typography>
    <Typography
      variant='body2'
      color='text.disabled'
    >
      The requested project does not exist or you do not have access.
    </Typography>
  </Box>
)
