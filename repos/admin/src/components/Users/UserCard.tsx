import type { TUserWithRole } from './Users'

import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Avatar,
  Tooltip,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TUserCard = {
  user: TUserWithRole
  onEditRole: (user: TUserWithRole) => void
  onRemoveUser: (user: TUserWithRole) => void
}

const getRoleColor = (roleType?: string) => {
  switch (roleType) {
    case 'super':
      return 'error'
    case 'admin':
      return 'warning'
    case 'basic':
    default:
      return 'default'
  }
}

const getRoleLabel = (roleType?: string) => {
  return roleType?.toUpperCase() || 'BASIC'
}

const getInitials = (user: TUserWithRole) => {
  if (user.first && user.last) {
    return `${user.first[0]}${user.last[0]}`.toUpperCase()
  }
  if (user.displayName) {
    const parts = user.displayName.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return user.displayName.substring(0, 2).toUpperCase()
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase()
  }
  return 'U'
}

export const UserCard = ({ user, onEditRole, onRemoveUser }: TUserCard) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            src={user.image}
            sx={{ width: 56, height: 56, mr: 2 }}
          >
            {getInitials(user)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant='h6'
              component='h3'
            >
              {user.displayName || `${user.first} ${user.last}`}
            </Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {user.email}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Chip
            label={getRoleLabel(user.roleType)}
            color={getRoleColor(user.roleType)}
            size='small'
          />
          <Typography
            variant='caption'
            color='text.secondary'
          >
            {user.provider || 'Email'}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <Tooltip title='Edit Role'>
          <IconButton
            size='small'
            color='primary'
            onClick={() => onEditRole(user)}
            disabled={user.roleType === 'super'}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={user.roleType === 'super' ? 'Cannot remove super admin' : 'Remove User'}
        >
          <span>
            <IconButton
              size='small'
              color='error'
              onClick={() => onRemoveUser(user)}
              disabled={user.roleType === 'super'}
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
