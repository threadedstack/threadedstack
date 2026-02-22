import { Text } from 'ink'
import { themed } from '@TRL/theme'
import { memo, useState, useEffect, startTransition } from 'react'
import { SpinnerFrames } from '@TRL/constants'

type TSpinner = {
  message?: string
}

export const Spinner = memo((props: TSpinner) => {
  const { message = `Working...` } = props
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      startTransition(() => setFrame((prev) => (prev + 1) % SpinnerFrames.length))
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text>
      {themed(`primary`, SpinnerFrames[frame])} {themed(`muted`, message)}
    </Text>
  )
})
