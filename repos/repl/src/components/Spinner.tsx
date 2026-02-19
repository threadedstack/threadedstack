import React, { useState, useEffect } from 'react'
import { Text } from 'ink'
import { themed } from '@TRL/theme'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

type SpinnerProps = {
  message?: string
}

export function Spinner({ message = 'Working...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text>
      {themed('primary', FRAMES[frame])} {themed('muted', message)}
    </Text>
  )
}
