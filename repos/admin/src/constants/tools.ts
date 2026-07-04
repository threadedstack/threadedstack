import { EAgentTool } from '@tdsk/domain'

/**
 * Available AI Agent Tools for the agent ToolsSelector.
 * Values come straight from the shared EAgentTool enum (@tdsk/domain) — the
 * same names the AgentRunner filters on — so a selection here always matches
 * a real runner tool.
 */
export const AvailableTools = [
  {
    value: EAgentTool.shellExec,
    label: `Shell Execute`,
    description: `Execute shell commands`,
  },
  { value: EAgentTool.readFile, label: `Read File`, description: `Read file contents` },
  {
    value: EAgentTool.writeFile,
    label: `Write File`,
    description: `Write content to files`,
  },
  { value: EAgentTool.deleteFile, label: `Delete File`, description: `Delete files` },
  {
    value: EAgentTool.fileExists,
    label: `File Exists`,
    description: `Check if a file exists`,
  },
  {
    value: EAgentTool.listDir,
    label: `List Directory`,
    description: `List directory contents`,
  },
  {
    value: EAgentTool.mkdir,
    label: `Create Directory`,
    description: `Create directories`,
  },
  {
    value: EAgentTool.evalCode,
    label: `Evaluate Code`,
    description: `Evaluate JavaScript in an isolated sandbox`,
  },
  { value: EAgentTool.webSearch, label: `Web Search`, description: `Search the web` },
  {
    value: EAgentTool.webFetch,
    label: `Web Fetch`,
    description: `Fetch and extract content from a URL`,
  },
  {
    value: EAgentTool.createArtifact,
    label: `Create Artifact`,
    description: `Create a renderable artifact (HTML, SVG, Markdown, ...)`,
  },
  {
    value: EAgentTool.memorySearch,
    label: `Memory Search`,
    description: `Search durable long-term memory`,
  },
  {
    value: EAgentTool.memoryWrite,
    label: `Memory Write`,
    description: `Persist a durable memory`,
  },
  {
    value: EAgentTool.authorSkill,
    label: `Author Skill`,
    description: `Propose a reusable skill (scanned + curator-gated)`,
  },
  {
    value: EAgentTool.skillsList,
    label: `List Skills`,
    description: `List the agent's active skills`,
  },
  {
    value: EAgentTool.skillView,
    label: `View Skill`,
    description: `View one active skill's instructions`,
  },
  {
    value: EAgentTool.delegateTask,
    label: `Delegate Task`,
    description: `Delegate a task to a bounded child coding process`,
  },
] as const

export type TAvailableTool = (typeof AvailableTools)[number][`value`]
