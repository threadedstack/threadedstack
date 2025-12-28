import type { TAnyCB } from '@TSC/types'

import { useState, useEffect } from 'react'

export type THSyncValue = {
  value?:any
  onChange?:TAnyCB
}

export const useSyncValue = (props:THSyncValue) => {
  
  const {
    value,
    onChange
  } = props

  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    if (value !== internalValue) setInternalValue(value)
  }, [value])

  const onChangeCB = (event:any) => {
    setInternalValue(event.target.value)
    onChange?.(event)
  }

  return {
    value: internalValue,
    onChange: onChangeCB,
  }

}