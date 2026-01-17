import type { MouseEvent } from 'react'

import { useState } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { Button, Text } from '@tdsk/components'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { OrgsMenu } from '@TAF/components/Breadcrumbs/OrgsMenu'
import { useActiveOrgId, useActiveOrg } from '@TAF/state/selectors'

const styles = {
  icon: {
    fontSize: 18,
  },
  text: {
    fontWeight: 500,
    maxWidth: 150,
    overflow: `hidden`,
    whiteSpace: `nowrap`,
    textOverflow: `ellipsis`,
  },
  button: {
    color: `text.primary`,
    [`&.open .MuiButton-endIcon`]: {
      transform: `rotate(180deg)`,
    },
    [`& .MuiButton-endIcon`]: {
      transform: `rotate(0deg)`,
      transition: `transform 0.2s ease`,
    },
  },
}

export type TOrgSelector = {
  className?: string
  onCreateOrg?: () => void
}

export const OrgSelector = (props: TOrgSelector) => {
  const { className, onCreateOrg } = props

  const [activeOrg] = useActiveOrg()
  const [activeOrgId] = useActiveOrgId()
  const [query, setQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  return (
    <>
      <Button
        onClick={onClick}
        sx={styles.button}
        EndIcon={<ExpandMoreIcon />}
        className={cls(`tdsk-org-selector`, open && `open`, className)}
      >
        <OrgIcon
          text
          sx={styles.icon}
        />
        <Text
          variant='body2'
          sx={styles.text}
        >
          {activeOrg?.name}
        </Text>
      </Button>

      <OrgsMenu
        open={open}
        query={query}
        onClose={onClose}
        setQuery={setQuery}
        anchorEl={anchorEl}
        onCreateOrg={onCreateOrg}
        activeOrgId={activeOrgId}
      />
    </>
  )
}
