import type { Organization } from '@tdsk/domain'

import { useCallback } from 'react'
import { dims } from '@tdsk/components'
import { useNavigate } from 'react-router'
import { Page } from '@TTH/pages/Page/Page'
import { styled } from '@mui/material/styles'
import { selectOrg } from '@TTH/actions/orgs'
import { useOrgs, useOrgId } from '@TTH/state/selectors'
import { Business, ChevronRight } from '@mui/icons-material'
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material'

const PageRoot = styled(Box)`
  width: 100%;
  margin: 0 auto;
  max-width: 700px;
`

const OrgCard = styled(Card)(({ theme }) => ({
  borderRadius: dims.border.mdpx,
  transition: `box-shadow 200ms ease, border-color 200ms ease`,
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
  },
}))

type TOrgCardItem = {
  org: Organization
  active: boolean
  onSelect: (orgId: string) => void
}

const OrgCardItem = (props: TOrgCardItem) => {
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

const EmptyState = () => (
  <Box
    sx={{
      py: 8,
      gap: 2,
      display: `flex`,
      alignItems: `center`,
      flexDirection: `column`,
      justifyContent: `center`,
    }}
  >
    <Business sx={{ fontSize: 48, color: `text.disabled` }} />
    <Typography
      variant='body1'
      color='text.secondary'
    >
      No organizations found
    </Typography>
  </Box>
)

const Orgs = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const navigate = useNavigate()

  const onSelect = useCallback(
    (id: string) => {
      selectOrg(id)
      navigate(`/orgs/${id}/projects`)
    },
    [navigate]
  )

  return (
    <Page className='tdsk-orgs-page'>
      <PageRoot>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant='h5'
            sx={{ fontWeight: 600 }}
          >
            Organizations
          </Typography>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mt: 0.5 }}
          >
            Choose an organization to continue
          </Typography>
        </Box>

        {orgs.length === 0 ? (
          <EmptyState />
        ) : (
          <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}>
            {orgs.map((org) => (
              <OrgCardItem
                key={org.id}
                org={org}
                active={org.id === orgId}
                onSelect={onSelect}
              />
            ))}
          </Box>
        )}
      </PageRoot>
    </Page>
  )
}

export default Orgs
