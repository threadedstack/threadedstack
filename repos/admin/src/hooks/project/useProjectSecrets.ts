import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { useSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'

export type THOrgSecrets = {
  orgId?: string
  projectId?: string
}

export const useProjectSecrets = (props: THOrgSecrets) => {
  const { orgId, projectId } = props

  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!orgId || !projectId || secrets) return

    ife(async () => {
      setLoading(true)
      setError(null)
      const result = await fetchSecrets({ orgId, projectId })
      result.error && setError(result.error)
      setLoading(false)
    })
  }, [orgId, projectId, secrets])

  return {
    error,
    secrets,
    loading,
    setError,
    setLoading,
  }
}
