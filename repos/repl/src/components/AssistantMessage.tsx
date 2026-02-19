import React from 'react'
import { Text } from 'ink'
import { renderMarkdown } from '@TRL/utils/markdown'

type Props = { text: string; markdown?: boolean }

export function AssistantMessage({ text, markdown = true }: Props) {
  const rendered = markdown ? renderMarkdown(text) : text
  return <Text>{rendered}</Text>
}
