import { useState, useCallback } from 'react'


export const useForceUpdate = () => {
  const [_, dispatch] = useState(Object.create(null))
  return useCallback(() => dispatch(Object.create(null)), [])
}