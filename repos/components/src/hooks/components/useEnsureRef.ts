import type { Ref, MutableRefObject } from 'react'

import { useMemo, useRef } from 'react'

type TRef<T = any> = Ref<T> | MutableRefObject<T>

export const useEnsureRef = <T = any, R extends TRef<T> = MutableRefObject<T>>(
  ref: R
) => {
  const localRef = useRef<T>()

  return useMemo(() => {
    return (ref || localRef) as R
  }, [ref])
}
