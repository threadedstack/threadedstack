import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { useOrgSecrets as useOSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'

export type THOrgSecrets = {
  orgId?: string
}

export const useOrgSecrets = (props: THOrgSecrets) => {
  const { orgId } = props

  const [secrets] = useOSecrets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!orgId || secrets) return

    ife(async () => {
      setLoading(true)
      setError(null)
      const result = await fetchSecrets({ orgId })
      result.error && setError(result.error)
      setLoading(false)
    })
  }, [orgId, secrets])

  return {
    error,
    secrets,
    loading,
    setError,
    setLoading,
  }
}
