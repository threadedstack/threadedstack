import { Box, Typography } from '@mui/material'
import { FolderOpen } from '@mui/icons-material'

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
    <FolderOpen sx={{ fontSize: 48, color: `text.disabled` }} />
    <Typography
      variant='body1'
      color='text.secondary'
    >
      No sandboxes configured for this project
    </Typography>
  </Box>
)
