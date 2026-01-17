import { useState } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { useOrgs } from '@TAF/state/selectors'
import { useEffectOnce } from '@tdsk/components'
import { fetchOrgs } from '@TAF/actions/orgs/api/fetchOrgs'

export const useOrgsState = () => {
  const [orgs] = useOrgs()
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
    orgs,
    error,
    loading,
  }
}
