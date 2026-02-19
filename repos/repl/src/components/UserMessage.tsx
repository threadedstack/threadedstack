import React from 'react'
import { Text } from 'ink'
import { themed } from '@TRL/theme'

export function UserMessage({ text }: { text: string }) {
  return <Text>{themed('secondary', `> ${text}`)}</Text>
}
