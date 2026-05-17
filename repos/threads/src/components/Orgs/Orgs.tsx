import { useCallback } from 'react'
import { nav } from '@TTH/services/nav'

import { OrgIcon } from '@tdsk/components'
import { styled } from '@mui/material/styles'
import { selectOrg } from '@TTH/actions/orgs'
import { Box, Typography } from '@mui/material'
import { EmptyState } from '@TTH/components/EmptyState'
import { useOrgs, useOrgId } from '@TTH/state/selectors'
import { OrgCardItem } from '@TTH/components/Orgs/OrgCardItem'

const PageRoot = styled(Box)`
  width: 100%;
  margin: 0 auto;
  max-width: 700px;
`

export const Orgs = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const onSelect = useCallback((id: string) => {
    selectOrg(id)
    nav.projects(id)
  }, [])

  return (
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
        <EmptyState
          icon={<OrgIcon />}
          title='No organizations found'
        />
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
  )
}

export default Orgs
