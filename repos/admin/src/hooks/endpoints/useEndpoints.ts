import type { Endpoint } from '@tdsk/domain'

import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { useCallback, useState } from 'react'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { useEndpointFilter } from '@TAF/hooks/endpoints/useEndpointFilter'
import { setActiveEndpoint } from '@TAF/actions/endpoints/local/setActiveEndpoint'
import {
  useActiveOrgId,
  useActiveProjectId,
  useProjectEndpoints,
} from '@TAF/state/selectors'

export const useEndpoints = () => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [query, setQuery] = useState(``)
  const [projectId] = useActiveProjectId()
  const [endpoints] = useProjectEndpoints()
  const [deleteError, setDeleteError] = useState(``)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)

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
      setActiveEndpoint(endpoint.id)
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

  const onCreateSuccess = useCallback(
    (endpoint?: Endpoint) => {
      setCreateDrawerOpen(false)
      if (endpoint?.id) {
        setActiveEndpoint(endpoint.id)
        const path = buildNavRoute(
          { orgId, projectId, endpointId: endpoint.id },
          ERoutePath.ProjectEndpoint
        )
        navigate(path)
      }
    },
    [navigate, orgId, projectId]
  )

  return {
    orgId,
    query,
    count,
    navigate,
    setQuery,
    onDelete,
    onCreate,
    projectId,
    onNavigate,
    deleteError,
    methodFilter,
    setMethodFilter,
    onCreateSuccess,
    createDrawerOpen,
    visibilityFilter,
    onCreateDrawerClose,
    setCreateDrawerOpen,
    setVisibilityFilter,
    endpoints: filtered,
    rawEndpoints: endpoints,
  }
}
