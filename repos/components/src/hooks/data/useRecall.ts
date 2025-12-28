import type { TAnyCB } from '@TSC/types'

import { useInline } from '@TSC/hooks/components/useInline'
import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useMemo, useRef } from 'react'

export type THCalling<T = any> = {
  reference: T
  deps: any[]
  callback: TAnyCB
}

export const useRecall = (props: THCalling) => {
  const { deps = [], callback, reference } = props

  // Force the deps to always be the same length
  const depsRef = useRef<any[]>(deps)
  const depends = useMemo(() => depsRef.current.map((_, idx) => deps?.[idx]), [deps])

  const callingRef = useRef<boolean>(false)
  const onRecall = useInline(async (...args: any[]) => {
    try {
      callingRef.current = true
      return await callback?.(...args)
    } finally {
      callingRef.current = false
    }
  })

  useEffect(() => {
    !reference &&
      !callingRef.current &&
      ife(async () => await onRecall(reference, ...deps))
  }, depends)

  return {
    onRecall,
  }
}
