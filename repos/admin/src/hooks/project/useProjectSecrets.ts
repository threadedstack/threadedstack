import { useState } from 'react'
import { useProjectSecrets as useProjectSecretsSelector } from '@TAF/state/selectors'

export const useProjectSecrets = () => {
  const [secrets] = useProjectSecretsSelector()
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
