import type { Organization, TOrgWithRole } from '@tdsk/domain'

import { useMemo } from 'react'
import { cmx } from '@TSC/theme/helpers'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { MonoFont } from '@TTH/constants/values'
import { ArrowForward } from '@mui/icons-material'
import { dims, Avatar, Chip } from '@tdsk/components'

export type TOrgCardItem = {
  org: Organization
  active: boolean
  onSelect: (orgId: string) => void
}

export const OrgCardItem = (props: TOrgCardItem) => {
  const { org, active, onSelect } = props
  const theme = useTheme()

  const role = (org as TOrgWithRole).userRole ?? undefined

  const metaParts: string[] = useMemo(() => {
    const parts: string[] = []
    if (role) parts.push(role)
    if (org.description) parts.push(org.description)
    return parts
  }, [role, org.description])

  return (
    <Box
      onClick={() => onSelect(org.id)}
      sx={{
        gap: `16px`,
        display: `flex`,
        cursor: `pointer`,
        border: `1px solid`,
        alignItems: `center`,
        padding: `18px 20px`,
        bgcolor: `background.paper`,
        transition: `all 200ms ease`,
        borderRadius: dims.border.mdpx,
        borderColor: active
          ? cmx(theme.palette.primary.main, `40`, theme.palette.divider)
          : `divider`,
        '&:hover': {
          borderColor: `primary.main`,
          boxShadow: theme.shadows[2],
          transform: `translateY(-1px)`,
          '& .org-arrow': {
            color: `primary.main`,
          },
        },
      }}
    >
      <Avatar
        name={org.name || org.id}
        identifier={org.id}
        size='xl'
        square
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: `8px` }}>
          <Typography
            noWrap
            sx={{
              fontSize: `15px`,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {org.name || org.id}
          </Typography>
          {active && (
            <Chip
              label='Default'
              variant='outlined'
              tone='primary'
              size='sm'
            />
          )}
        </Box>
        {metaParts.length > 0 && (
          <Typography
            noWrap
            sx={{
              fontSize: `12.5px`,
              color: `text.secondary`,
              mt: `3px`,
              fontFamily: MonoFont,
            }}
          >
            {metaParts.join(` · `)}
          </Typography>
        )}
      </Box>

      <ArrowForward
        className='org-arrow'
        sx={{
          fontSize: 20,
          flexShrink: 0,
          color: `text.secondary`,
          transition: `color 200ms ease`,
        }}
      />
    </Box>
  )
}
