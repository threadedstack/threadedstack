import { useInline } from '@TSC/hooks/components/useInline'
import { useState } from 'react'

export const useForceRender = () => {
  const [force, setToggle] = useState(false)

  return {
    force,
    onForceRender: useInline(() => setToggle((toggle) => !toggle)),
  }
}
