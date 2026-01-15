import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { ClipboardCopy } from '@tdsk/components'
import type { SxProps, Theme } from '@mui/material'

export type TInfoField = {
  label: string
  value: ReactNode
  copyable?: boolean
  monospace?: boolean
  sx?: SxProps<Theme>
}

export const InfoField = ({
  label,
  value,
  copyable = false,
  monospace = false,
  sx,
}: TInfoField) => {
  return (
    <Box sx={sx}>
      <Typography
        variant='subtitle2'
        color='text.secondary'
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant='body2'
          fontFamily={monospace ? 'monospace' : 'inherit'}
        >
          {value}
        </Typography>
        {copyable && typeof value === 'string' && <ClipboardCopy value={value} />}
      </Box>
    </Box>
  )
}

export default InfoField
