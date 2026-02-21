import { ToolDisplayNames } from '@TRL/constants'

export const getToolName = (toolName: string): string => {
  return ToolDisplayNames[toolName] || toolName
}
