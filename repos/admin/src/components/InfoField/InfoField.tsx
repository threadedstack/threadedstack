import type { ReactNode } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material'
import type { SxProps, Theme } from '@mui/material'

export type TInfoField = {
  label: string
  value: ReactNode
  copyable?: boolean
  onCopy?: (value: string) => void
  monospace?: boolean
  sx?: SxProps<Theme>
}

export const InfoField = ({
  label,
  value,
  copyable = false,
  onCopy,
  monospace = false,
  sx,
}: TInfoField) => {
  const handleCopy = () => {
    if (onCopy && typeof value === 'string') {
      onCopy(value)
    }
  }

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
        {copyable && typeof value === 'string' && (
          <IconButton
            size='small'
            onClick={handleCopy}
          >
            <ContentCopyIcon fontSize='small' />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}

export default InfoField
