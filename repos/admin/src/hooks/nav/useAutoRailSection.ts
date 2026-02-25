import type { TRailSectionId } from '@TAF/types'

import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router'
import { useActiveRailSection } from '@TAF/state/selectors'

const deriveSection = (
  pathname: string,
  orgId?: string,
  projectId?: string
): TRailSectionId => {
  if (projectId && pathname.includes(`/projects/${projectId}`)) return `project`
  if (orgId && pathname.includes(`/orgs/${orgId}`)) return `org`
  return `home`
}

export const useAutoRailSection = (orgId?: string, projectId?: string) => {
  const location = useLocation()
  const [activeSection, setActiveSection] = useActiveRailSection()
  const hasInit = useRef(false)

  useEffect(() => {
    const derived = deriveSection(location.pathname, orgId, projectId)
    setActiveSection((current) => {
      if (!hasInit.current) {
        hasInit.current = true
        return derived
      }
      if (current === null) return current
      if (current !== derived) return derived
      return current
    })
  }, [location.pathname, orgId, projectId, setActiveSection])

  return [activeSection, setActiveSection] as const
}
