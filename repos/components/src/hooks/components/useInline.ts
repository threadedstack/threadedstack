import { noOp } from '@keg-hub/jsutils'
import { MutableRefObject, useMemo, useRef } from 'react'

/*
 * Uses some typescript utility types to allow references to this in the memoized ref
 * See here => https://www.typescriptlang.org/docs/handbook/utility-types.html
 */
type TRefFunction<T extends TMemoFunc> = (
  this: ThisParameterType<T>,
  ...args: Parameters<T>
) => ReturnType<T>
type TMemoFunc = (this: any, ...args: any[]) => any

/**
 * Helper to create a memoize version of the passed in function
 * That is wrapped by an anonymous function controlled locally
 */
const useRefFunc = <T>(func: T) => {
  const funcRef = useRef<T>(func)
  funcRef.current = useMemo(() => func, [func])

  return funcRef
}

/**
 * Memoize the funcRef, which allows
 * The funcRef current value to change,
 * But the memoizedRef current value stays consistent
 * This allows using the function in places like useEffect with a consistent identity
 */
const useMemoizedRef = <T extends TMemoFunc>(funcRef: MutableRefObject<T>) => {
  const memoizedRef = useRef<TRefFunction<T>>()
  !memoizedRef.current &&
    (memoizedRef.current = function (this, ...args) {
      return funcRef.current.apply(this, args)
    })

  return memoizedRef.current as T
}

/**
 * Helper hook to memoize inline fat-arrow functions using useMemo and refs
 */
export const useInline = <T extends TMemoFunc>(func: T = noOp as T) => {
  const funcRef = useRefFunc<T>(func)
  return useMemoizedRef(funcRef)
}
