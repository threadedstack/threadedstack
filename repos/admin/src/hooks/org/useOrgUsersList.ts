import type { User } from '@tdsk/domain'

import { useMemo, useState, useEffect } from 'react'
import { listOrgUsers } from '@TAF/actions/users/listOrgUsers'
import { removeFromOrg } from '@TAF/actions/users/removeFromOrg'
import { useOrgUsers, useActiveOrgId } from '@TAF/state/selectors'

export const useOrgUsersList = () => {
  const [allUsers] = useOrgUsers()
  const [orgId] = useActiveOrgId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>(undefined)
  const users = useMemo(() => allUsers?.[orgId] || [], [orgId, allUsers])

  const loadUsers = async () => {
    if (!orgId) return setError(`An organization ID is required!`)

    setLoading(true)
    setError(undefined)
    const resp = await listOrgUsers(orgId)

    if (resp.error) {
      setError(resp.error.message)
    } else {
      setError(undefined)
    }

    setLoading(false)
  }

  const removeUser = async (user: User) => {
    if (!orgId) return setError(`An organization ID is required!`)

    setLoading(true)
    setError(undefined)
    const resp = await removeFromOrg(orgId, user.id)

    if (resp.error) {
      setError(resp.error.message)
    } else {
      setError(undefined)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [orgId])

  return {
    users,
    error,
    setError,
    loading,
    loadUsers,
    removeUser,
  }
}
