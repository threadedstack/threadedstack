import { Box, CircularProgress } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TLoadingSpinner = {
  size?: number
  sx?: SxProps<Theme>
}

export const LoadingSpinner = ({ size = 40, sx }: TLoadingSpinner) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4, ...sx }}>
      <CircularProgress size={size} />
    </Box>
  )
}

export default LoadingSpinner
