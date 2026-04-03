import type { Endpoint } from '@tdsk/domain'

import { ERoutePath } from '@TAF/types'
import { ife } from '@keg-hub/jsutils/ife'
import { useNavigate } from 'react-router'
import { useCallback, useEffect, useState } from 'react'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { setActiveEndpointId } from '@TAF/state/accessors'
import { fetchEndpoints } from '@TAF/actions/endpoints/api/fetchEndpoints'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { useEndpointFilter } from '@TAF/hooks/endpoints/useEndpointFilter'
import {
  useActiveOrgId,
  useActiveProjectId,
  useProjectEndpoints,
} from '@TAF/state/selectors'

export const useEndpoints = () => {
  const [endpoints] = useProjectEndpoints()
  const [orgId] = useActiveOrgId()
  const navigate = useNavigate()
  const [query, setQuery] = useState(``)
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [deleteError, setDeleteError] = useState(``)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !projectId) return
    ife(async () => {
      try {
        setLoading(true)
        await fetchEndpoints({ orgId, projectId })
      } finally {
        setLoading(false)
      }
    })
  }, [orgId, projectId])

  const {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  } = useEndpointFilter({
    query,
    endpoints,
  })

  const onDelete = async (id: string) => {
    const result = await deleteEndpoint({ orgId, projectId, id })
    result.error && setDeleteError(`Failed to delete endpoint: ${result.error.message}`)
  }

  const onCreate = () => {
    setCreateDrawerOpen(true)
  }

  const onNavigate = useCallback(
    (endpoint: Endpoint) => {
      setActiveEndpointId(endpoint.id)
      const path = buildNavRoute(
        { orgId, projectId, endpointId: endpoint.id },
        ERoutePath.ProjectEndpoint
      )
      navigate(path)
    },
    [navigate, orgId, projectId]
  )

  const onCreateDrawerClose = () => {
    setCreateDrawerOpen(false)
  }

  return {
    orgId,
    query,
    count,
    loading,
    navigate,
    setQuery,
    onDelete,
    onCreate,
    projectId,
    onNavigate,
    deleteError,
    methodFilter,
    createDrawerOpen,
    setMethodFilter,
    onCreateDrawerClose,
    setCreateDrawerOpen,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
