import { useState } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { useEffectOnce } from '@tdsk/components'
import { fetchOrgs } from '@TAF/actions/orgs/api/fetchOrgs'
import { useOrgs, useActiveOrg } from '@TAF/state/selectors'

export const useOrgState = () => {
  const [orgs] = useOrgs()
  const [org] = useActiveOrg()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<boolean>()

  const getOrgs = async () => {
    try {
      setLoading(true)
      error && setError(undefined)
      const resp = await fetchOrgs()
      resp.error && setError(resp.error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffectOnce(() => {
    ife(async () => {
      !orgs && !loading && !error && (await getOrgs())
    })
  })

  return {
    org,
    error,
    loading,
  }
}
