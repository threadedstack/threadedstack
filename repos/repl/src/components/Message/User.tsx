import { Text } from 'ink'
import { themed } from '@TRL/theme'

export type TUserMessage = { text: string }

export const UserMessage = (props: TUserMessage) => {
  const { text } = props
  return <Text>{themed('secondary', `> ${text}`)}</Text>
}
