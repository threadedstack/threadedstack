import { useState, useEffect } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { useProjects, useActiveOrgId } from '@TAF/state/selectors'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'

export const useProjectsState = () => {
  const [orgId] = useActiveOrgId()
  const [projects] = useProjects()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<boolean>()

  const getProjects = async (orgId: string) => {
    try {
      setLoading(true)
      error && setError(undefined)
      const resp = await fetchProjects({ orgId })
      resp.error && setError(resp.error.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ife(async () => {
      !projects && orgId && !loading && !error && (await getProjects(orgId))
    })
  }, [orgId])

  return {
    error,
    loading,
    projects,
  }
}
