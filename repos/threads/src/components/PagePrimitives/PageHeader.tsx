import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'

export type TPageHeader = {
  eyebrow?: string
  eyebrowIcon?: ReactNode
  title: ReactNode
  titleMono?: boolean
  subtitle?: string
  statusChip?: ReactNode
  actions?: ReactNode
}

export const PageHeader = (props: TPageHeader) => {
  const { title, eyebrow, actions, subtitle, titleMono, statusChip, eyebrowIcon } = props

  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `flex-start`,
        mb: `24px`,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <Box
            sx={{
              display: `flex`,
              alignItems: `center`,
              gap: `6px`,
              mb: `6px`,
              color: `text.secondary`,
              '& .MuiSvgIcon-root': {
                fontSize: 14,
              },
            }}
          >
            {eyebrowIcon}
            <Typography
              component='span'
              sx={{
                fontSize: `11px`,
                fontWeight: 600,
                letterSpacing: `0.08em`,
                textTransform: `uppercase`,
                color: `text.secondary`,
              }}
            >
              {eyebrow}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            gap: `12px`,
          }}
        >
          <Typography
            component='h1'
            sx={{
              fontSize: `30px`,
              fontWeight: titleMono ? 600 : 700,
              letterSpacing: `-0.02em`,
              lineHeight: 1.2,
              ...(titleMono && { fontFamily: MonoFont }),
            }}
          >
            {title}
          </Typography>
          {statusChip}
        </Box>
        {subtitle && (
          <Typography
            sx={{
              fontSize: `14px`,
              color: `text.secondary`,
              maxWidth: `720px`,
              lineHeight: 1.55,
              mt: `8px`,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ ml: `auto`, flexShrink: 0, display: `flex`, gap: `8px` }}>
          {actions}
        </Box>
      )}
    </Box>
  )
}
