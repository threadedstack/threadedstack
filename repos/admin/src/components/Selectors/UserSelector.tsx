import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TUserSelector = {
  loading?: boolean
  disabled?: boolean
  required?: boolean
  selectedUserIds: string[]
  onChange: (userIds: string[]) => void
  users: Array<{ id: string; name: string; email?: string }>
}

export type TUserSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  required?: boolean
  userId: string | null
  onChange: (userId: string | null) => void
  users: Array<{ id: string; name: string; email?: string }>
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
  const { loading, disabled, users, selectedUserIds, required, onChange } = props
  const options = useUserOptions(users)

  return (
    <EntitySelector
      id='entity-users'
      title='Users'
      label='Users'
      loading={loading}
      options={options}
      required={required}
      onChange={onChange}
      value={selectedUserIds}
      placeholder='Select users...'
      disabled={disabled || users.length === 0}
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
  const { loading, disabled, users, userId, required, onChange } = props
  const options = useUserOptions(users)

  return (
    <EntitySelectorSingle
      id='entity-user'
      label='User'
      value={userId}
      options={options}
      loading={loading}
      onChange={onChange}
      required={required}
      placeholder='Select user...'
      disabled={disabled || users.length === 0}
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
