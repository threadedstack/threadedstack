/**
 * Available AI Agent Tools
 * Derived from repos/agent/src/tools directory
 */
// TODO: move to @tdsk/domains so it can be shared across repos
// Convert it to an enum to it works like other shared enum constants
export const AvailableTools = [
  { value: `shellExec`, label: `Shell Execute`, description: `Execute shell commands` },
  { value: `readFile`, label: `Read File`, description: `Read file contents` },
  { value: `writeFile`, label: `Write File`, description: `Write content to files` },
  { value: `deleteFile`, label: `Delete File`, description: `Delete files` },
  { value: `fileExists`, label: `File Exists`, description: `Check if file exists` },
  { value: `getFileStats`, label: `Get File Stats`, description: `Get file statistics` },
  {
    value: `listDirectory`,
    label: `List Directory`,
    description: `List directory contents`,
  },
  {
    value: `createDirectory`,
    label: `Create Directory`,
    description: `Create directories`,
  },
  { value: `webSearch`, label: `Web Search`, description: `Search the web` },
  { value: `spawnSubAgent`, label: `Spawn Sub-Agent`, description: `Spawn a sub-agent` },
  {
    value: `sendMessageToSubAgent`,
    label: `Send to Sub-Agent`,
    description: `Send message to sub-agent`,
  },
  {
    value: `receiveMessageFromSubAgent`,
    label: `Receive from Sub-Agent`,
    description: `Receive from sub-agent`,
  },
  {
    value: `terminateSubAgent`,
    label: `Terminate Sub-Agent`,
    description: `Terminate a sub-agent`,
  },
  {
    value: `executeCustomTool`,
    label: `Custom Tool`,
    description: `Execute custom user-defined tool`,
  },
] as const

export type TAvailableTool = (typeof AvailableTools)[number][`value`]
