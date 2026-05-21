import { useCallback } from 'react'
import { nav } from '@TTH/services/nav'

import Box from '@mui/material/Box'
import { OrgIcon } from '@tdsk/components'
import { selectOrg } from '@TTH/actions/orgs'
import { GridView } from '@mui/icons-material'
import { EmptyState } from '@TTH/components/EmptyState'
import { useOrgs, useOrgId } from '@TTH/state/selectors'
import { PageHeader } from '@TTH/components/PagePrimitives'
import { OrgCardItem } from '@TTH/components/Orgs/OrgCardItem'

export const Orgs = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const onSelect = useCallback((id: string) => {
    selectOrg(id)
    nav.projects(id)
  }, [])

  return (
    <Box sx={{ width: `100%`, margin: `0 auto`, maxWidth: 700 }}>
      <PageHeader
        eyebrow='Organizations'
        eyebrowIcon={<GridView />}
        title='Your Organizations'
        subtitle='Choose an organization to continue'
      />

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
    </Box>
  )
}

export default Orgs
