import type { MouseEvent } from 'react'

import { useState } from 'react'
import { OrgIcon, SelectorButton, SelectorMenu } from '@tdsk/components'
import { selectOrg } from '@TTH/actions/orgs'
import { useOrgs, useOrgId, useActiveOrg } from '@TTH/state/selectors'

export const OrgSelector = () => {
  const orgs = useOrgs()
  const orgId = useOrgId()
  const activeOrg = useActiveOrg()
  const [query, setQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  const items = orgs.map((o) => ({
    id: o.id,
    name: o.name || o.id,
    description: o.description,
  }))

  return (
    <>
      <SelectorButton
        icon={
          <OrgIcon
            text
            sx={{ fontSize: 18 }}
          />
        }
        text={activeOrg?.name}
        open={open}
        onClick={onClick}
        className='tdsk-org-selector'
        placeholder='Select Org'
      />
      <SelectorMenu
        items={items}
        query={query}
        setQuery={setQuery}
        activeId={orgId}
        open={open}
        anchorEl={anchorEl}
        onSelect={(item) => selectOrg(item.id)}
        onClose={onClose}
        searchPlaceholder='Search organizations...'
        emptyMessage='No organizations found'
      />
    </>
  )
}
