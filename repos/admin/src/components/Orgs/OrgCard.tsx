import type { Organization } from '@tdsk/domain'

import { useState } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { styled } from '@mui/material/styles'
import { ConfirmDelete, Text } from '@tdsk/components'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { Box, Card, Chip, Typography, CardContent } from '@mui/material'

const CardOrg = styled(Card)(({ theme }) => {
  return `
    height: 160px;
    cursor: pointer;
    max-height: 160px;
    transition: all 0.2s;
    border: 1px solid ${theme.palette.border.default};

    &.active {
      border: 2px solid ${theme.palette.primary.main};
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: ${theme.palette.colors.shadows?.sm};
    }
  `
})

const DescText = styled(Text)`
  overflow: hidden;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
`

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

  const [deleted, setDeleted] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const onDeleteCancel = () => setDeleting(false)
  const onDeleteConfirm = () => {
    if (!showDelete) return
    setDeleted(true)
    onDelete?.(org.id)
  }

  return (
    <>
      <CardOrg
        onClick={() => onSelect?.(org.id)}
        className={cls(`tdsk-org-card`, active && `active`)}
      >
        <CardContent>
          <Box sx={{ display: `flex`, alignItems: `center`, mb: 1.5 }}>
            <OrgIcon text />
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
          <DescText
            sx={{ mb: 1.5 }}
            variant='body2'
            color='text.secondary'
          >
            {org.description || `No description`}
          </DescText>
          <Typography
            variant='caption'
            color='text.secondary'
          >
            ID: {org.id}
          </Typography>
        </CardContent>
      </CardOrg>

      {showDelete && deleting && (
        <ConfirmDelete
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
