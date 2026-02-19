export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  listDir: 'Listed directory',
  readFile: 'Read file',
  writeFile: 'Wrote file',
  deleteFile: 'Deleted file',
  shellExec: 'Ran command',
  webSearch: 'Searched the web',
  webFetch: 'Fetched webpage',
  codeSearch: 'Searched code',
}

export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName
}
