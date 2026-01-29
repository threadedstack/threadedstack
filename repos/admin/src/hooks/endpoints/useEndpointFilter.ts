import type { Endpoint } from '@tdsk/domain'

import { useState, useMemo } from 'react'

export type THEndpointFilter = {
  query: string
  projectId: string
  endpoints: Record<string, Endpoint>
}

export const useEndpointFilter = (props: THEndpointFilter) => {
  const { query, projectId, endpoints } = props

  const [methodFilter, setMethodFilter] = useState<string>(`all`)
  const [visibilityFilter, setVisibilityFilter] = useState<string>(`all`)

  const { count, filtered } = useMemo(() => {
    if (!endpoints || !projectId) return { filtered: [], count: 0 }

    const eps = Object.values(endpoints)

    const count = endpoints ? eps.filter((e) => e.projectId === projectId).length : 0

    let filtered = eps.filter((endpoint) => endpoint.projectId === projectId)

    if (methodFilter !== `all`)
      filtered = filtered.filter((endpoint) => endpoint.method === methodFilter)

    if (visibilityFilter !== `all`) {
      const isPublic = visibilityFilter === `public`
      filtered = filtered.filter((endpoint) => endpoint.public === isPublic)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(
        (endpoint) =>
          endpoint.name?.toLowerCase().includes(q) ||
          endpoint.url?.toLowerCase().includes(q) ||
          endpoint.id?.toLowerCase().includes(q)
      )
    }

    return { filtered, count }
  }, [query, endpoints, projectId, methodFilter, visibilityFilter])

  return {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
