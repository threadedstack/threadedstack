
import type { MouseEvent, FocusEvent } from "react"

import { isStr } from "@keg-hub/jsutils"
import { useInline } from "./useInline"
import { useCallback, useState } from "react"
import { stopEvent } from '@TSC/utils/helpers'

export type THProp<V=any, T=Record<string, any>> = {
  parent:T
  prop:keyof T
  stopEvt?:boolean
  required?:string
  onChange: (updated:T, prop:keyof T, value:V, ...args:any[]) => void
}

export const useProp = <V=any, T=Record<string, any>>(props:THProp<V, T>) => {

  const {
    prop,
    parent,
    onChange,
    required,
    stopEvt=true,
  } = props

  const onChangeIn = useInline(onChange)
  const [err, setErr] = useState<string>(``)

  const onChangeCB = useCallback((
    evt:MouseEvent<any>|FocusEvent<any>,
    ...args:any[]
  ) => {
    stopEvt && stopEvent(evt)

    const update = (evt.target as HTMLInputElement).value

    if(!update || isStr(update) && !update.trim())
      return required && setErr(required)

    if(update !== parent[prop]){
      const updated = {...parent, [prop]: update}
      onChangeIn?.(updated, prop, update as V, ...args)
    }

    setErr(``)
  }, [
    err,
    prop,
    parent,
    required,
  ])

  return {
    error: err,
    setError: setErr,
    onChange: onChangeCB
  }

}