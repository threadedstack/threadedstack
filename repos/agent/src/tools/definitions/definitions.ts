import { FSTools } from './fs'
import { WebTools } from './web'
import { AgentTools } from './agent'
import { ShellTools } from './shell'

export const ToolDefinitions = {
  ...FSTools,
  ...WebTools,
  ...AgentTools,
  ...ShellTools,
}
