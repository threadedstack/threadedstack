import type { Organization } from '@tdsk/domain'

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { cls } from '@keg-hub/jsutils/cls'
import { setActiveOrgId, resetActiveprojectId } from '@TAF/state/accessors'
import { useOrgs, useActiveOrgId, useActiveOrg } from '@TAF/state/selectors'
import {
  Add as AddIcon,
  Check as CheckIcon,
  GridView as OrgIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import {
  Box,
  Menu,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
  ListItemIcon,
  ListItemText,
  InputAdornment,
} from '@mui/material'

export type TOrgSelector = {
  className?: string
  onCreateOrg?: () => void
}

export const OrgSelector = (props: TOrgSelector) => {
  const { className, onCreateOrg: onCreateOrgCB } = props

  const navigate = useNavigate()
  const [orgs] = useOrgs()
  const [activeOrgId] = useActiveOrgId()
  const [activeOrg] = useActiveOrg()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const open = Boolean(anchorEl)

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setSearchQuery('')
  }

  const onSelectOrg = (org: Organization) => {
    resetActiveprojectId()
    setActiveOrgId(org.id)
    navigate(`/orgs/${org.id}`)
    onClose()
  }

  const onCreateOrg = () => {
    onClose()
    onCreateOrgCB?.()
  }

  const orgsArray = useMemo(() => {
    if (!orgs) return []
    return Object.values(orgs)
  }, [orgs])

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return orgsArray
    const query = searchQuery.toLowerCase()
    return orgsArray.filter((org) => org.name?.toLowerCase().includes(query))
  }, [orgsArray, searchQuery])

  const getOrgInitials = (name: string) => {
    if (!name) return '?'
    const words = name.split(' ')
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      <Button
        onClick={onClick}
        className={cls('tdsk-org-selector', className)}
        endIcon={<ExpandMoreIcon />}
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          '& .MuiButton-endIcon': {
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          },
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: '12px',
            fontWeight: 600,
            mr: 1,
          }}
        >
          {activeOrg ? getOrgInitials(activeOrg.name) : <OrgIcon sx={{ fontSize: 16 }} />}
        </Box>
        <Typography
          variant='body2'
          sx={{
            fontWeight: 500,
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeOrg?.name || 'Select Organization'}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              maxWidth: 320,
              maxHeight: 400,
            },
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {orgsArray.length > 3 && (
          <Box sx={{ px: 1, py: 0.5 }}>
            <TextField
              size='small'
              fullWidth
              placeholder='Search organizations...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>
                      <SearchIcon
                        fontSize='small'
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '14px',
                },
              }}
            />
          </Box>
        )}

        {orgsArray.length > 3 && <Divider sx={{ my: 0.5 }} />}

        <Box sx={{ maxHeight: 250, overflow: 'auto' }}>
          {filteredOrgs.length === 0 && searchQuery && (
            <MenuItem disabled>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                No organizations found
              </Typography>
            </MenuItem>
          )}

          {filteredOrgs.map((org) => (
            <MenuItem
              key={org.id}
              onClick={() => onSelectOrg(org)}
              selected={org.id === activeOrgId}
              sx={{
                py: 1,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemIcon>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    display: 'flex',
                    fontSize: '13px',
                    fontWeight: 600,
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: org.id === activeOrgId ? 'primary.main' : 'grey.300',
                    color:
                      org.id === activeOrgId ? 'primary.contrastText' : 'text.primary',
                  }}
                >
                  {getOrgInitials(org.name)}
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={org.name}
                secondary={org.description}
                primaryTypographyProps={{
                  sx: {
                    overflow: `hidden`,
                    whiteSpace: `nowrap`,
                    textOverflow: `ellipsis`,
                    fontWeight: org.id === activeOrgId ? 600 : 400,
                  },
                }}
                secondaryTypographyProps={{
                  sx: {
                    fontSize: `12px`,
                    overflow: `hidden`,
                    whiteSpace: `nowrap`,
                    textOverflow: `ellipsis`,
                  },
                }}
              />
              {org.id === activeOrgId && (
                <CheckIcon
                  fontSize='small'
                  color='primary'
                />
              )}
            </MenuItem>
          ))}
        </Box>

        {(onCreateOrgCB && <Divider sx={{ my: 0.5 }} />) || null}
        {(onCreateOrgCB && (
          <MenuItem onClick={onCreateOrg}>
            <ListItemIcon>
              <AddIcon fontSize='small' />
            </ListItemIcon>
            <ListItemText primary='Create Organization' />
          </MenuItem>
        )) ||
          null}
      </Menu>
    </>
  )
}
