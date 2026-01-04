import { useCallback, useState } from 'react'
import { noOp, get } from '@keg-hub/jsutils'

type TResetMethod = (arg:any) => void
type TMethod = (...args:any[]) => void
type TResetResponse = [val:any, setVal:TMethod, updateVal:TMethod, resetVal:TMethod]

export const useReset = (
  method:TResetMethod=noOp,
  val:any=null
) => {
  return useCallback(() => method(val), [method, val])
}

export const useUpdate = <T=any, E=Record<any, any>>(
  setVal:TMethod,
  val:any,
  path?:string,
) => {
  return useCallback((data:E) => {
    const updated = get<T>(data as Record<any, any>, path || ``, data as unknown as T)
    setVal(updated)
  }, [path, val, setVal])
}

export const useStateReset = <T=any, E=Record<any, any>>(
  initial:any=null,
  def:any=initial,
  path?:string
) => {
  const [val, setVal] = useState<T>(initial || def)
  const resetVal = useReset(setVal, def)
  const updateVal = useUpdate<T, E>(setVal, val, path)

  return [
    val,
    setVal,
    resetVal,
    updateVal
  ] as TResetResponse
}