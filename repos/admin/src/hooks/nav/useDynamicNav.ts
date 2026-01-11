import { useMemo } from 'react'
import { getDynamicNav } from '@TAF/utils/nav/getDynamicNav'
import { useActiveNavData } from '@TAF/hooks/nav/useActiveNavData'

export const useDynamicNav = () => {
  const context = useActiveNavData()

  const config = useMemo(() => getDynamicNav(context), [context])

  return {
    config,
    context,
  }
}
