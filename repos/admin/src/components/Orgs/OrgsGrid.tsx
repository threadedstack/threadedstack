import { Grid } from '@mui/material'
import type { Organization } from '@tdsk/domain'
import { OrgCard } from '@TAF/components/Orgs/OrgCard'

export type TOrgsGrid = {
  activeOrgId?: string
  orgs: Organization[]
  onSelect?: (orgId: string) => void
}

export const OrgsGrid = (props: TOrgsGrid) => {
  const { orgs, onSelect, activeOrgId } = props

  return (
    <Grid
      container
      spacing={3}
    >
      {orgs.map((org) => {
        const isActiveOrg = org.id === activeOrgId
        return (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            key={org.id}
          >
            <OrgCard
              org={org}
              onSelect={onSelect}
              active={isActiveOrg}
            />
          </Grid>
        )
      })}
    </Grid>
  )
}
