import type { TAvatar } from '@TSC/types'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'
import Typography from '@mui/material/Typography'
import { getInitials } from '@TSC/utils/getInitials'
import { getAvatarColor } from '@TSC/utils/getAvatarColor'
import { SizeMap, FontSizeMap } from '@TSC/constants/elements'

export const Avatar = (props: TAvatar) => {
  const { src, name, identifier, size = `md`, square = false } = props

  const px = SizeMap[size]
  const fontSize = FontSizeMap[size]
  const initials = useMemo(() => getInitials(name) || `??`, [name])
  const bgColor = useMemo(() => getAvatarColor(identifier || name), [identifier, name])

  if (src) {
    return (
      <Box
        src={src}
        alt={name}
        component='img'
        sx={{
          width: px,
          height: px,
          flexShrink: 0,
          objectFit: `cover`,
          borderRadius: square ? dims.border.mdpx : `50%`,
        }}
      />
    )
  }

  return (
    <Box
      sx={{
        width: px,
        height: px,
        flexShrink: 0,
        color: `#fff`,
        display: `flex`,
        bgcolor: bgColor,
        alignItems: `center`,
        justifyContent: `center`,
        borderRadius: square ? dims.border.mdpx : `50%`,
      }}
    >
      <Typography
        sx={{
          fontSize,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: `0.02em`,
        }}
      >
        {initials}
      </Typography>
    </Box>
  )
}
