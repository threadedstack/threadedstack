import { useMemo } from 'react'
import { getRailNavConfig } from '@TAF/utils/nav/getRailNavConfig'
import { useActiveNavData } from '@TAF/hooks/nav/useActiveNavData'

export const useRailNav = () => {
  const context = useActiveNavData()
  const config = useMemo(() => getRailNavConfig(context), [context])

  return { config, context }
}
