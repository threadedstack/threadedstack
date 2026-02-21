import { join } from 'node:path'

export const ConfigDir = join(process.env.HOME || `~`, `.config`, `tdsk`)
export const ConfigPath = join(ConfigDir, `tsa.yaml`)
export const HistoryDir = join(ConfigDir, `history`)

export const ProjectDir = `.tdsk`
export const AgentsFile = `AGENTS.md`
export const ContextDir = `${ProjectDir}/context`
export const ProjectConfig = `${ProjectDir}/config.yaml`

export const paths = {
  agentMd: AgentsFile,
  configDir: ConfigDir,
  proCfg: ProjectConfig,
  globalCfg: ConfigPath,
  contextDir: ContextDir,
  projectDir: ProjectDir,
  historyDir: HistoryDir,
}
