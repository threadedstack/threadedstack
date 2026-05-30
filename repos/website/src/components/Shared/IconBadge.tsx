import type { ComponentType } from 'react'

import Box from '@mui/material/Box'

type Props = {
  icon: ComponentType<{ sx?: object }>
  size?: number
  iconSize?: number
}

const IconBadge = ({ icon: Icon, size = 44, iconSize = 26 }: Props) => (
  <Box
    sx={{
      width: size,
      height: size,
      borderRadius: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: (t) =>
        t.palette.mode === 'dark' ? 'rgba(51,112,222,0.12)' : 'rgba(51,112,222,0.08)',
    }}
  >
    <Icon sx={{ fontSize: iconSize, color: 'primary.main' }} />
  </Box>
)

export default IconBadge
