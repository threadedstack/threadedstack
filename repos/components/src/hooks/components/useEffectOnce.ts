import { useEffect, useRef, useState } from 'react'

export const useEffectOnce = (effect: () => void | (() => void)) => {
  const rendered = useRef(false)
  const effectCalled = useRef(false)
  const [, setVal] = useState<number>(0)
  const destroyFn = useRef<void | (() => void) | null>(null)
  const effectFn = useRef<() => void | (() => void)>(effect)

  // Track if our useEffect has been called
  // So we know if it's the dummy rerender react forces in Dev
  if (effectCalled.current) rendered.current = true

  useEffect(() => {
    // Only execute the effect on first call
    if (!effectCalled.current) {
      destroyFn.current = effectFn.current()
      effectCalled.current = true
    }

    // Force a render after the effect call
    setVal((val) => val + 1)

    return () => {
      // If it has render since the useEffect was called then call the destroy func
      rendered.current && destroyFn.current && destroyFn.current?.()
    }
  }, [])
}
