import { ToolDisplayNames } from '@TSA/constants'

export const getToolName = (toolName: string): string => {
  return ToolDisplayNames[toolName] || toolName
}
