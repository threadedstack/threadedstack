import type { Endpoint } from '@tdsk/domain'

import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { exists } from '@keg-hub/jsutils/exists'
import { fetchEndpoints } from '@TAF/actions/endpoints/api/fetchEndpoints'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { useEndpointFilter } from '@TAF/hooks/endpoints/useEndpointFilter'
import {
  useEndpoints as useEps,
  useActiveProjectId,
  useActiveOrgId,
} from '@TAF/state/selectors'

export const useEndpoints = () => {
  const [endpoints] = useEps()
  const [orgId] = useActiveOrgId()
  const [query, setQuery] = useState(``)
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [deleteError, setDeleteError] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null)

  useEffect(() => {
    orgId &&
      projectId &&
      !exists(endpoints) &&
      ife(async () => {
        try {
          setLoading(true)
          await fetchEndpoints({ orgId, projectId })
        } finally {
          setLoading(false)
        }
      })
  }, [orgId, projectId, endpoints])

  const {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  } = useEndpointFilter({
    query,
    projectId,
    endpoints,
  })

  const onDelete = async (id: string) => {
    const result = await deleteEndpoint({ orgId, projectId, id })
    result.error && setDeleteError(`Failed to delete endpoint: ${result.error.message}`)
  }

  const onCreate = () => {
    setEndpoint(null)
    setDialogOpen(true)
  }

  const onEdit = (endpoint: Endpoint) => {
    setEndpoint(endpoint)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setEndpoint(null)
  }

  return {
    orgId,
    query,
    count,
    onEdit,
    loading,
    setQuery,
    onDelete,
    endpoint,
    onCreate,
    projectId,
    dialogOpen,
    deleteError,
    methodFilter,
    onDialogClose,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
