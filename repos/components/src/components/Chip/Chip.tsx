import type { TChip, TChipTone } from '@TSC/types'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { cmx } from '@TSC/theme/helpers'
import MuiChip from '@mui/material/Chip'
import { useTheme, keyframes } from '@mui/material/styles'

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0px currentColor; }
  100% { box-shadow: 0 0 0 4px transparent; }
`

const useToneColor = (tone: TChipTone) => {
  const theme = useTheme()
  const stateColors = theme.palette.colors?.states

  return useMemo(() => {
    switch (tone) {
      case `success`:
        return stateColors?.success ?? `#2cb67d`
      case `warning`:
        return stateColors?.warning ?? `#F59E0B`
      case `error`:
        return stateColors?.danger ?? `#EF4444`
      case `info`:
        return stateColors?.info ?? `#4FC3F7`
      case `primary`:
        return theme.palette.primary.main
      case `neutral`:
        return theme.palette.text.secondary
    }
  }, [tone, stateColors, theme])
}

export const Chip = (props: TChip) => {
  const {
    label,
    tone = `neutral`,
    variant = `tint`,
    size = `md`,
    pulse: showPulse = false,
    icon,
  } = props

  const color = useToneColor(tone)
  const height = size === `sm` ? 20 : 24

  if (variant === `outlined`) {
    return (
      <MuiChip
        size='small'
        label={label}
        variant='outlined'
        icon={icon as any}
        sx={{
          color,
          height,
          fontSize: 11,
          fontWeight: 500,
          borderColor: cmx(color, `40`),
          '& .MuiChip-label': { px: `8px` },
          '& .MuiChip-icon': { fontSize: 14 },
        }}
      />
    )
  }

  if (variant === `solid`) {
    return (
      <MuiChip
        size='small'
        label={label}
        icon={icon as any}
        sx={{
          height,
          fontSize: 11,
          color: `#fff`,
          bgcolor: color,
          fontWeight: 500,
          '& .MuiChip-label': { px: `8px` },
          '& .MuiChip-icon': { fontSize: 14, color: `#fff` },
        }}
      />
    )
  }

  const dotLabel = (
    <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px` }}>
      {(showPulse || !icon) && (
        <Box
          sx={{
            width: 6,
            height: 6,
            flexShrink: 0,
            bgcolor: color,
            borderRadius: `50%`,
            ...(showPulse && {
              color: cmx(color, `40`),
              animation: `${pulse} 1.5s ease-in-out infinite`,
            }),
          }}
        />
      )}
      {icon}
      {label}
    </Box>
  )

  return (
    <MuiChip
      size='small'
      label={dotLabel}
      sx={{
        height,
        fontSize: 11,
        fontWeight: 500,
        bgcolor: cmx(color, `10`),
        border: `1px solid ${cmx(color, `30`)}`,
        '& .MuiChip-label': { px: `8px` },
      }}
    />
  )
}
