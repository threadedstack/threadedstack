import type { Organization } from '@tdsk/domain'

import { useState } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { styled } from '@mui/material/styles'
import OrgIcon from '@mui/icons-material/GridView'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'

import { Box, Card, Chip, useTheme, Typography, CardContent } from '@mui/material'

const CardOrg = styled(Card)(({ theme }) => {
  return `
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.12);
    transition: all 0.2s;
  
    &.active {
      2px solid ${theme.palette.primary.main};
    }
  
    &:hover {
      box-shadow: 3;
      transform: translateY(-4px);
    }
  `
})

export type TOrgCard = {
  active?: boolean
  org: Organization
  deleting?: boolean
  showDelete?: boolean
  onDelete?: (orgId: string) => void
  onSelect?: (orgId: string) => void
}

export const OrgCard = (props: TOrgCard) => {
  const { org, active, onDelete, onSelect, showDelete } = props

  const theme = useTheme()
  const [deleted, setDeleted] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const onDeleteCancel = () => setDeleting(false)
  const onDeleteConfirm = () => {
    if (!showDelete) return
    setDeleted(true)
    onDelete(org.id)
  }

  return (
    <>
      <CardOrg
        onClick={() => onSelect?.(org.id)}
        className={cls(`tdsk-org-card`, active && `active`)}
      >
        <CardContent>
          <Box sx={{ display: `flex`, alignItems: `center`, mb: 1 }}>
            <OrgIcon sx={{ mr: 1, color: `primary.main` }} />
            <Typography
              variant='h6'
              component='h2'
              sx={{ flexGrow: 1 }}
            >
              {org.name}
            </Typography>
            {active && (
              <Chip
                size='small'
                label='Current'
                color='primary'
              />
            )}
          </Box>
          <Typography
            sx={{ mb: 1 }}
            variant='body2'
            color='text.secondary'
          >
            {org.description || `No description`}
          </Typography>
          <Typography
            variant='caption'
            color='text.secondary'
          >
            ID: {org.id}
          </Typography>
        </CardContent>
      </CardOrg>

      {showDelete && deleting && (
        <ConfirmDeleteAlert
          deleting={deleted}
          itemName={org?.name}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
          title={`Delete ${org?.name}`}
          text={
            <Box
              pt={3}
              pb={3}
            >
              Are you sure you want to delete this organization?
              <br />
              <br />
              This action cannot be undone and organization team members will lose access.
            </Box>
          }
        />
      )}
    </>
  )
}
