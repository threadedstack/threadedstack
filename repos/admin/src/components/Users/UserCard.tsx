import type { User } from '@tdsk/domain'

import { ERoleType } from '@tdsk/domain'
import { useUser } from '@TAF/state/selectors'
import { getInitials } from '@TAF/utils/user/getInitials'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
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
  user: User
  onEditRole: (user: User) => void
  onRemoveUser: (user: User) => void
}

export const UserCard = (props: TUserCard) => {
  const [authUser] = useUser()

  const { user, onEditRole, onRemoveUser } = props

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
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Chip
            size='small'
            color={getRoleColor(user.role as ERoleType)}
            label={(user.role || ERoleType.viewer)?.toUpperCase()}
          />
          <Typography
            variant='caption'
            color='text.secondary'
          >
            {user.provider || `Email`}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <Tooltip title='Edit Role'>
          <span>
            <IconButton
              size='small'
              color='primary'
              onClick={() => onEditRole(user)}
              disabled={authUser.role === ERoleType.viewer}
            >
              <EditIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={
            user.role === ERoleType.super ? `Cannot remove super admin` : `Remove User`
          }
        >
          <span>
            <IconButton
              size='small'
              color='error'
              onClick={() => onRemoveUser(user)}
              disabled={authUser.role === ERoleType.super}
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
