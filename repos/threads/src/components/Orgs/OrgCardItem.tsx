import type { Organization } from '@tdsk/domain'

import { dims } from '@tdsk/components'
import { styled } from '@mui/material/styles'
import { Business, ChevronRight } from '@mui/icons-material'
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material'

const OrgCard = styled(Card)(({ theme }) => ({
  borderRadius: dims.border.mdpx,
  transition: `box-shadow 200ms ease, border-color 200ms ease`,
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
  },
}))

export type TOrgCardItem = {
  org: Organization
  active: boolean
  onSelect: (orgId: string) => void
}

export const OrgCardItem = (props: TOrgCardItem) => {
  const { org, active, onSelect } = props

  return (
    <OrgCard variant='outlined'>
      <CardActionArea
        onClick={() => onSelect(org.id)}
        sx={{
          p: 2.5,
          gap: 2,
          display: `flex`,
          alignItems: `center`,
          justifyContent: `flex-start`,
        }}
      >
        <Business
          sx={{ fontSize: 28, color: active ? `primary.main` : `text.secondary` }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
            <Typography
              variant='subtitle1'
              noWrap
              sx={{ fontWeight: 500 }}
            >
              {org.name || org.id}
            </Typography>
            {active && (
              <Chip
                size='small'
                label='Current'
                color='primary'
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
          </Box>
          {org.description && (
            <Typography
              variant='body2'
              color='text.secondary'
              noWrap
              sx={{ mt: 0.25 }}
            >
              {org.description}
            </Typography>
          )}
        </Box>
        <ChevronRight sx={{ color: `text.disabled` }} />
      </CardActionArea>
    </OrgCard>
  )
}
