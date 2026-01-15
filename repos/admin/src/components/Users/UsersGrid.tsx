import type { User } from '@tdsk/domain'

import { Grid } from '@mui/material'
import { UserCard } from './UserCard'

export type TUsersGrid = {
  users: User[]
  onEditRole: (user: User) => void
  onRemoveUser: (user: User) => void
}

export const UsersGrid = ({ users, onEditRole, onRemoveUser }: TUsersGrid) => {
  return (
    <Grid
      container
      spacing={3}
    >
      {users.map((user) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          key={user.id}
        >
          <UserCard
            user={user}
            onEditRole={onEditRole}
            onRemoveUser={onRemoveUser}
          />
        </Grid>
      ))}
    </Grid>
  )
}
