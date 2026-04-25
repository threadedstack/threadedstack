import { useCallback } from 'react'
import { selectOrg } from '@TTH/actions/orgs'
import { useOrgs, useOrgId } from '@TTH/state/selectors'
import { Box, Select, MenuItem, Typography } from '@mui/material'

export const OrgSelector = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()

  const handleChange = useCallback((evt: { target: { value: string } }) => {
    selectOrg(evt.target.value)
  }, [])

  if (!orgs.length) return null

  return (
    <Box sx={{ px: 1, py: 1 }}>
      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ px: 0.5, mb: 0.5, display: `block` }}
      >
        Organization
      </Typography>
      <Select
        value={orgId || ``}
        onChange={handleChange}
        size='small'
        fullWidth
        displayEmpty
        sx={{ fontSize: `0.875rem` }}
      >
        {!orgId && (
          <MenuItem
            value=''
            disabled
          >
            <Typography
              variant='body2'
              color='text.secondary'
            >
              Select an organization
            </Typography>
          </MenuItem>
        )}
        {orgs.map((org) => (
          <MenuItem
            key={org.id}
            value={org.id}
          >
            {org.name || org.id}
          </MenuItem>
        ))}
      </Select>
    </Box>
  )
}
