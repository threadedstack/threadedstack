import type { Endpoint } from '@tdsk/domain'

import { useState, useMemo } from 'react'

export type THEndpointFilter = {
  query: string
  endpoints: Record<string, Endpoint>
}

export const useEndpointFilter = (props: THEndpointFilter) => {
  const { query, endpoints } = props

  const [methodFilter, setMethodFilter] = useState<string>(`all`)
  const [visibilityFilter, setVisibilityFilter] = useState<string>(`all`)

  const { count, filtered } = useMemo(() => {
    if (!endpoints) return { filtered: [], count: 0 }

    const eps = Object.values(endpoints)
    const count = eps.length

    let filtered = [...eps]

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
          endpoint.path?.toLowerCase().includes(q) ||
          endpoint.id?.toLowerCase().includes(q)
      )
    }

    return { filtered, count }
  }, [query, endpoints, methodFilter, visibilityFilter])

  return {
    count,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
    endpoints: filtered,
  }
}
