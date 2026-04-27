import type { MouseEvent } from 'react'

import { nav } from '@TTH/services/nav'
import { selectOrg } from '@TTH/actions/orgs'
import { useState, useCallback } from 'react'
import { useOrgs, useOrgId, useActiveOrg } from '@TTH/state/selectors'
import { OrgIcon, SelectorButton, SelectorMenu } from '@tdsk/components'

export const OrgSelector = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const [activeOrg] = useActiveOrg()
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

  const onSelect = useCallback((item: { id: string }) => {
    selectOrg(item.id)
    onClose()
    nav.projects(item.id)
  }, [])

  const items = orgs.map((o) => ({
    id: o.id,
    name: o.name || o.id,
    description: o.description,
  }))

  return (
    <>
      <SelectorButton
        open={open}
        onClick={onClick}
        text={activeOrg?.name}
        placeholder='Select Org'
        className='tdsk-org-selector'
        icon={
          <OrgIcon
            text
            sx={{ fontSize: 18 }}
          />
        }
      />
      <SelectorMenu
        open={open}
        items={items}
        query={query}
        activeId={orgId}
        onClose={onClose}
        setQuery={setQuery}
        anchorEl={anchorEl}
        onSelect={onSelect}
        searchPlaceholder='Search organizations...'
        emptyMessage='No organizations found'
      />
    </>
  )
}
