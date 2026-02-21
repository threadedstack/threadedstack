import { Text } from 'ink'
import { renderMarkdown } from '@TRL/utils/markdown'

type TAssistantMessage = { text: string; markdown?: boolean }

export const AssistantMessage = (props: TAssistantMessage) => {
  const { text, markdown = true } = props
  const rendered = markdown ? renderMarkdown(text) : text
  return <Text>{rendered}</Text>
}
