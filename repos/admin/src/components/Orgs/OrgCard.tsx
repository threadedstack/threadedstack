import type { Organization } from '@tdsk/domain'

import { useState } from 'react'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'
import {
  Group as OrgIcon,
  Delete as DeleteIcon,
  ArrowForward as SelectIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Tooltip,
  useTheme,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

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
      <Card
        sx={{
          cursor: `pointer`,
          transition: `all 0.2s`,
          border: active
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid rgba(0, 0, 0, 0.12)`,
          [`&:hover`]: {
            transform: `translateY(-4px)`,
            boxShadow: 3,
          },
        }}
        onClick={() => onSelect?.(org.id)}
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
        <CardActions sx={{ justifyContent: `space-between`, px: 2, pb: 2 }}>
          {(showDelete && (
            <Tooltip title='Delete Org'>
              <IconButton
                size='small'
                color='error'
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleting(true)
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )) ||
            null}
          <Tooltip title={active ? `Continue with Org` : `Select Org`}>
            <IconButton
              size='small'
              color='primary'
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(org.id)
              }}
            >
              <SelectIcon />
            </IconButton>
          </Tooltip>
        </CardActions>
      </Card>

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
