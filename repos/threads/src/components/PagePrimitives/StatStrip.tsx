import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'

export type TStatCell = {
  label: string
  value: ReactNode
  help?: string
  icon?: ReactNode
  sans?: boolean
}

export type TStatStrip = {
  cells: TStatCell[]
}

const StatCell = (props: TStatCell) => {
  const { label, value, help, icon, sans } = props

  return (
    <Box
      sx={{
        bgcolor: `background.paper`,
        padding: `14px 18px`,
      }}
    >
      <Typography
        sx={{
          fontSize: `10.5px`,
          fontWeight: 600,
          letterSpacing: `0.08em`,
          textTransform: `uppercase`,
          color: `text.secondary`,
          mb: `4px`,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: `6px`,
        }}
      >
        {icon && (
          <Box
            sx={{
              display: `flex`,
              color: `text.secondary`,
              '& .MuiSvgIcon-root': { fontSize: 16 },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          component='span'
          sx={{
            fontSize: `18px`,
            fontWeight: 600,
            letterSpacing: `-0.01em`,
            ...(sans ? {} : { fontFamily: MonoFont }),
          }}
        >
          {value}
        </Typography>
      </Box>
      {help && (
        <Typography
          sx={{
            fontSize: `11px`,
            color: `text.secondary`,
            mt: `2px`,
          }}
        >
          {help}
        </Typography>
      )}
    </Box>
  )
}

export const StatStrip = (props: TStatStrip) => {
  const { cells } = props

  return (
    <Box
      sx={{
        display: `grid`,
        gap: `1px`,
        bgcolor: `divider`,
        border: 1,
        borderColor: `divider`,
        borderRadius: `8px`,
        overflow: `hidden`,
        mb: `28px`,
        gridTemplateColumns: `repeat(6, minmax(0, 1fr))`,
        '@media (max-width: 1099px)': {
          gridTemplateColumns: `repeat(3, minmax(0, 1fr))`,
        },
        '@media (max-width: 639px)': {
          gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
        },
      }}
    >
      {cells.map((cell) => (
        <StatCell
          key={cell.label}
          {...cell}
        />
      ))}
    </Box>
  )
}
