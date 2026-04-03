import { useState } from 'react'
import { useOrgSecrets as useOSecrets } from '@TAF/state/selectors'

export const useOrgSecrets = () => {
  const [secrets] = useOSecrets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  return {
    error,
    secrets,
    loading,
    setError,
    setLoading,
  }
}
