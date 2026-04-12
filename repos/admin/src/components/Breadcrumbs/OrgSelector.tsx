import type { MouseEvent } from 'react'

import { useState } from 'react'
import { setOrgActive } from '@TAF/actions/orgs/local/setOrgActive'
import { OrgIcon, SelectorButton, SelectorMenu } from '@tdsk/components'
import { useOrgs, useActiveOrgId, useActiveOrg } from '@TAF/state/selectors'

export type TOrgSelector = {
  className?: string
  onCreateOrg?: () => void
}

export const OrgSelector = (props: TOrgSelector) => {
  const { className, onCreateOrg } = props

  const [orgs] = useOrgs()
  const [activeOrg] = useActiveOrg()
  const [query, setQuery] = useState('')
  const [activeOrgId] = useActiveOrgId()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  const items = orgs
    ? Object.values(orgs).map((o) => ({
        id: o.id,
        name: o.name || o.id,
        description: o.description,
      }))
    : []

  return (
    <>
      <SelectorButton
        open={open}
        onClick={onClick}
        className={className}
        text={activeOrg?.name}
        placeholder='Select Org'
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
        onClose={onClose}
        anchorEl={anchorEl}
        setQuery={setQuery}
        activeId={activeOrgId}
        onCreate={onCreateOrg}
        createLabel='Create Organization'
        emptyMessage='No organizations found'
        searchPlaceholder='Search organizations...'
        onSelect={(item) => setOrgActive(item.id)}
      />
    </>
  )
}
