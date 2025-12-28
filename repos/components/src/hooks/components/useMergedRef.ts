import type { Ref, RefCallback } from 'react'

import { isFunc } from '@keg-hub/jsutils/isFunc'
import { isObj } from '@keg-hub/jsutils/isObj'
import { useCallback } from 'react'

export const useMergedRef = <T = any>(...refs: Ref<T>[]): RefCallback<T> => {
  return useCallback((element: T) => {
    refs.forEach((ref) => {
      isFunc(ref)
        ? ref(element)
        : isObj(ref) && ((ref as React.MutableRefObject<T>).current = element)
    })
  }, refs)
}
