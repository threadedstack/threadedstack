import type { MutableRefObject, ReactNode } from 'react'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useForceUpdate } from '@TSC/hooks/components/useForceUpdate'

export type TPortal = {
  id?:string
  children:ReactNode
  elementRef?:MutableRefObject<HTMLElement|null|undefined>
}

const hasDocument = typeof document !== `undefined`


export const Portal = (props:TPortal) => {
  const {
    id,
    children,
    elementRef,
  } = props


  const portalRef = useRef<HTMLElement>()
  const forceUpdate = useForceUpdate()

  useEffect(() => {
    const current = portalRef.current
    const element = elementRef?.current
      || id && document.getElementById(id) as HTMLElement

    if(!element) return console.log(`Can not find Portal Dom element`)
    if(current && element === current) return

    portalRef.current = element as HTMLElement
    forceUpdate()
  })

  return portalRef.current
    ? createPortal(children, portalRef.current)
    : null
}