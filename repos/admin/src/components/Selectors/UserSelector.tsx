import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TUserSelector = {
  loading?: boolean
  disabled?: boolean
  users: Array<{ id: string; name: string; email?: string }>
  selectedUserIds: string[]
  onChange: (userIds: string[]) => void
}

export type TUserSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  users: Array<{ id: string; name: string; email?: string }>
  userId: string | null
  onChange: (userId: string | null) => void
}

const useUserOptions = (users: TUserSelector['users']) =>
  useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: u.name || u.id,
        secondary: u.email,
      })),
    [users]
  )

export const UserSelector = (props: TUserSelector) => {
  const { loading, disabled, users, selectedUserIds, onChange } = props
  const options = useUserOptions(users)

  return (
    <EntitySelector
      id='entity-users'
      title='Users'
      label='Users'
      loading={loading}
      disabled={disabled || users.length === 0}
      value={selectedUserIds}
      options={options}
      onChange={onChange}
      placeholder='Select users...'
      description={
        loading
          ? 'Loading users...'
          : users.length === 0
            ? 'No users available.'
            : 'Select users'
      }
    />
  )
}

export const UserSelectorSingle = (props: TUserSelectorSingle) => {
  const { loading, disabled, users, userId, onChange } = props
  const options = useUserOptions(users)

  return (
    <EntitySelectorSingle
      id='entity-user'
      label='User'
      loading={loading}
      disabled={disabled || users.length === 0}
      value={userId}
      options={options}
      onChange={onChange}
      placeholder='Select user...'
      description={
        loading
          ? 'Loading users...'
          : users.length === 0
            ? 'No users available.'
            : 'Select a user'
      }
    />
  )
}
