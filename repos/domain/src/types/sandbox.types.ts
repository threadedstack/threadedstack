import type { TGuiConfig } from '@TDM/types/gui.types'
import type { TAgentSkill } from '@TDM/types/skill.types'
import type { TSandboxSyncDefaults } from '@TDM/types/sync.types'

import { EAIProviderBrand } from '@TDM/types/ai.types'

/**
 * Subset of AI provider brands that have sandbox env var mappings, plus composite
 * auth-method variants (e.g. amazon-bedrock:bearer). This enum is intentionally a
 * SUBSET of EAIProviderBrand — only brands with entries in RuntimeProviderEnvMap need
 * to appear here. When adding a new AI provider to EAIProviderBrand, also add it here
 * if the sandbox should support injecting its credentials.
 */
export enum ERuntimeBrand {
  zai = EAIProviderBrand.zai,
  custom = EAIProviderBrand.custom,
  ollama = EAIProviderBrand.ollama,
  openai = EAIProviderBrand.openai,
  google = EAIProviderBrand.google,
  deepseek = EAIProviderBrand.deepseek,
  anthropic = EAIProviderBrand.anthropic,
  openrouter = EAIProviderBrand.openrouter,
  googleVertex = EAIProviderBrand.googleVertex,
  amazonBedrock = EAIProviderBrand.amazonBedrock,
  ollamaCloud = `${EAIProviderBrand.ollama}:cloud`,
  anthropicOAuth = `${EAIProviderBrand.anthropic}:oauth`,
  amazonBedrockBearer = `${EAIProviderBrand.amazonBedrock}:bearer`,
}

export type TEnvVarInjection = `mitm` | `direct` | `file`

type TRuntimeEnvVarBase = {
  envVar: string
  filePath?: string
  required?: boolean
  defaultValue?: string
  injection?: TEnvVarInjection
}

export type TSecretEnvVar = TRuntimeEnvVarBase & { source: `secret` }
export type TOptionEnvVar = TRuntimeEnvVarBase & { source: `option`; optionKey: string }
export type TStaticEnvVar = TRuntimeEnvVarBase & { source: `static`; staticValue: string }
export type TRuntimeEnvVar = TSecretEnvVar | TOptionEnvVar | TStaticEnvVar

/**
 * Brand key can be a plain TAIProviderBrand or a composite key like 'amazon-bedrock:bearer'
 * for auth method variants. resolveProviderEnv builds the composite key at runtime.
 */
export type TRuntimeProviderEnvMap = Record<
  TSandboxRuntimeId,
  Partial<Record<ERuntimeBrand, TRuntimeEnvVar[]>>
>

export type TRuntimeSkillConfig = {
  basePath: string
  fileLayout: `flat` | `nested`
  fileName: string
}

export type TSandboxSkillLink = {
  id: string
  skillId: string
  sandboxId: string
  projectId?: string | null
  priority: number
  skill: TAgentSkill
}

/**
 * Sandbox provider types for modular sandbox integration
 */

export enum ESandboxType {
  local = `local`,
  kubernetes = `kubernetes`,
}

export type TSandboxType = `${ESandboxType}`

export enum ESandboxRuntime {
  codex = `codex`,
  custom = `custom`,
  openCode = `opencode`,
  openClaw = `openclaw`,
  claudeCode = `claude-code`,
  antigravity = `antigravity`,
  piCodingAgent = `pi-coding-agent`,
}

export type TSBRuntimeConfig = {
  args?: string[]
  command?: string[]
  initScript?: string
  promptCommand?: string
  runtimeCommand?: string
}

export type TSandboxRuntimeId = `${ESandboxRuntime}`

export enum EProto {
  http = `http`,
  https = `https`,
}

export type TProto = `${EProto}`

/**
 * Result of a command/file operation in the sandbox
 */
export type TSandboxResult = {
  output: string
  error?: string
  success: boolean
  exitCode?: number
}

export type TExecStreamOpts = {
  onStdout?: (chunk: Buffer) => void
  onStderr?: (chunk: Buffer) => void
}

/**
 * Sandbox configuration
 */
export type TSandboxConfig = {
  provider: TSandboxType
  /** Timeout in milliseconds for sandbox operations */
  timeout?: number
  /** Environment variables to set in sandbox */
  envVars?: Record<string, string>
  /** Provider-specific options */
  options?: Record<string, unknown>
}

/**
 * Result of evaluating code in the sandbox
 */
export type TSandboxEvalResult = {
  /** Structured return value. Available when the runtime supports it (e.g., V8 isolate default export). Undefined for process-based runtimes. */
  result: unknown
  /** Captured output (stdout for process-based sandboxes, console output for V8 isolate) */
  output: string
  /** Error output (stderr or exception message) */
  error?: string
}

/**
 * Options for eval()
 */
export type TSandboxEvalOpts = {
  /** Code execute runtime, i.e. node, python, ect. */
  runtime?: string
  /** Execution timeout in ms (provider-specific; local sandbox defaults to 5000ms) */
  timeout?: number
  /** Named ES modules to register before evaluation.
   *  Keys are import specifiers, values are module source code.
   *  The evaluated code can import from them by name. */
  modules?: Record<string, string>
  /** Named host bridge callbacks exposed to the evaluated code for this run only.
   *  Keys are bridge names; values are async host functions that receive a
   *  JSON-encoded args array and return a JSON-encoded result. Used to give
   *  evaluated code a platform-mediated capability (e.g. project-scoped record
   *  access) without ever handing the isolate a raw handle to the host resource.
   *  The bridge functions run host-side; only their invocation crosses the
   *  boundary (as JSON strings), mirroring the fetch host bridge. */
  bridges?: Record<string, (argsJson: string) => Promise<string>>
}

/**
 * ISandbox - interface for an active sandbox instance
 */
export interface ISandbox {
  /** Reset sandbox state for reuse (clear filesystem, provider-specific cleanup) */
  reset(): Promise<void>
  /** Close/destroy the sandbox */
  close(): Promise<void>
  /** Create a directory */
  mkdir(path: string): Promise<void>
  /** Read a file */
  readFile(path: string): Promise<string>
  /** Delete a file */
  deleteFile(path: string): Promise<void>
  /** List directory contents */
  listDir(path: string): Promise<string[]>
  /** Check if a file exists */
  fileExists(path: string): Promise<boolean>
  /** Write a file */
  writeFile(path: string, content: string): Promise<void>
  /** Execute a shell command */
  exec(command: string, args?: string[]): Promise<TSandboxResult>
  /** Execute a shell command with streaming stdout/stderr callbacks */
  execStreaming?(
    command: string,
    args?: string[],
    opts?: TExecStreamOpts
  ): Promise<TSandboxResult>
  /** Execute code using the sandbox's configured runtime */
  evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>
}

/**
 * ISandboxProvider - factory for creating sandbox instances
 */
export interface ISandboxProvider {
  readonly type: TSandboxType
  /** Create a new sandbox instance */
  create(config: TSandboxConfig): Promise<ISandbox>
}

// --- K8s sandbox types ---

export type TPortConfig = {
  protocol: TProto
}

export type TSandboxRuntime = {
  name: string
  command: string
  extension: string
}

export enum EImagePullPolicy {
  Never = `Never`,
  Always = `Always`,
  IfNotPresent = `IfNotPresent`,
}

export type TImagePullPolicy = `${EImagePullPolicy}`

export type TKubeSandboxConfig = {
  image: string
  args?: string[]
  workdir?: string
  command?: string[]
  sshEnabled?: boolean
  /** Shell script run as a K8s postStart hook (concurrent with the entrypoint's
   * git clone) for environment/home prep — does NOT gate readiness. */
  initScript?: string
  /** Project setup script run by the entrypoint AFTER the git clone and BEFORE
   * the workspace-ready marker, as the `sandbox` user in /workspace. This is the
   * language-agnostic hook for dependency installation and build steps
   * (`pnpm install`, `bundle install`, `go mod download`, ...). The AI tool /
   * interactive session waits for it to finish, so a one-shot run never starts
   * before its dependencies exist. */
  setupScript?: string
  secretIds?: string[]
  maxInstances?: number
  /** Shell command executed by `tsa run` after SSH connect to launch the AI tool */
  runtimeCommand?: string
  /** Shell command template for running a prompt (use {prompt} placeholder) */
  promptCommand?: string
  defaultRuntime?: string
  idleTimeoutMinutes?: number
  /** Which AI tool runtime to activate (claude-code, codex, opencode, or custom) */
  runtime?: TSandboxRuntimeId
  sync?: TSandboxSyncDefaults
  runtimes?: TSandboxRuntime[]
  envVars?: Record<string, string>
  ports?: Record<string, TPortConfig>
  imagePullPolicy?: TImagePullPolicy
  resources?: {
    limits?: { cpu?: string; memory?: string }
    requests?: { cpu?: string; memory?: string }
  }
  /** Override the default skill installation path for this runtime */
  skillPath?: string
  /** Sandbox-level generative UI config override (overrides org-level guiConfig when set) */
  guiConfig?: TGuiConfig
}

export type TPlaceholderEntry = {
  secretId: string
  allowedDomains?: string[]
}

export type TPlaceholderMap = Record<string, TPlaceholderEntry>

export enum EContainerState {
  Failed = `Failed`,
  Pending = `Pending`,
  Running = `Running`,
  Unknown = `Unknown`,
  Succeeded = `Succeeded`,
  Terminating = `Terminating`,
}

export type TContainerMeta = {
  podIp: string
  state: EContainerState
  sandboxId: string
  podName: string
}

export type TRouteEntry = {
  host: string
  port: number
  protocol: TProto
}

export type TRouteMapEntry = {
  meta: TContainerMeta
  placeholders: TPlaceholderMap
  ports: Record<string, TRouteEntry>
}

export type TRouteMap = Record<string, TRouteMapEntry>

export type TSandboxSession = {
  orgId: string
  userId: string
  sandboxId: string
  sessionId: string
  instanceId: string
  projectId?: string
  connectedAt: string
  hasShellSession?: boolean
  visibility: ESandboxSessionVisibility
}

export enum ESandboxSessionVisibility {
  private = `private`,
  public = `public`,
}

export type TSandboxSessionVisibility = `${ESandboxSessionVisibility}`

export enum EShellMsg {
  Error = `error`,
  Joined = `joined`,
  Resize = `resize`,
  Signal = `signal`,
  UserLeft = `user-left`,
  Connected = `connected`,
  Visibility = `visibility`,
  UserJoined = `user-joined`,
  Reconnected = `reconnected`,
  Disconnected = `disconnected`,
  PortsChanged = `ports-changed`,
  SandboxStopping = `sandbox-stopping`,
  SessionsUpdated = `sessions-updated`,
  FileTreeChanged = `file-tree-changed`,
  InstancesUpdated = `instances-updated`,
  PermissionResponse = `permission-response`,
}

export type TSandboxStopResponse = {
  success: boolean
  stoppedCount?: number
  failedInstances?: string[]
}

export type TSBConnectResp = {
  alias?: string
  workdir: string
  command: string
  sandboxId: string
  instanceId: string
  shellToken?: string
  subdomain?: string
  portUrlTemplate?: string
}

export type TSandboxStatusResp = {
  state: string
  instanceId: string
}

export type TSandboxStartResp = {
  instanceId: string
}

export type TSandboxInstance = {
  userId: string
  sandboxId: string
  instanceId: string
  state: EContainerState
  sessions: TSandboxSession[]
}

export type TSBInstancesResp = {
  maxInstances: number
  instances: TSandboxInstance[]
}

export enum ESBState {
  Error = `Error`,
  Running = `Running`,
  Stopped = `Stopped`,
  Starting = `Starting`,
}

/**
 * Per-project sandbox configuration overrides.
 * Stored on the sandboxProjects junction table.
 * NULL config = inherit from base sandbox config.
 */
export type TSandboxProjectConfig = {
  sandboxId: string
  projectId: string
  enabled?: boolean
  alias: string
  config?: Partial<TKubeSandboxConfig> | null
}

export type TSandboxConnectOpts = {
  sessionId?: string
  instanceId?: string
  newInstance?: boolean
}

export type TSandboxStopOpts = {
  force?: boolean
  stopAll?: boolean
  instanceId?: string
}

export type TSessionsUpdatedMessage = {
  sandboxId: string
  sessions: TSandboxSession[]
  type: EShellMsg.SessionsUpdated
}

export enum EFileOp {
  list = `list`,
  read = `read`,
  size = `size`,
  write = `write`,
  create = `create`,
  delete = `delete`,
  exists = `exists`,
}

export type TMutatingFileOp = EFileOp.create | EFileOp.delete | EFileOp.write

export type TFileOpType = `${EFileOp}`

export type TFileChangeRequest =
  | { op: EFileOp.list; path: string }
  | { op: EFileOp.read; path: string }
  | { op: EFileOp.size; path: string }
  | { op: EFileOp.exists; path: string }
  | { op: EFileOp.write; path: string; content: string }
  | { op: EFileOp.create; path: string; entryType: `file` | `folder` }
  | { op: EFileOp.delete; path: string; entryType: `file` | `folder` }

export type TFileTreeChangedMessage = {
  path: string
  sandboxId: string
  instanceId: string
  changeType: TMutatingFileOp
  entryType: `file` | `folder`
  type: EShellMsg.FileTreeChanged
}

export type TPortsChangedMessage = {
  sandboxId: string
  instanceId: string
  detected: TDetectedPort[]
  type: EShellMsg.PortsChanged
  exposed: Record<string, TPortConfig>
}

export type TInstancesUpdatedMessage = TSBInstancesResp & {
  sandboxId: string
  type: EShellMsg.InstancesUpdated
}

export type TMonitorMessage =
  | TSessionsUpdatedMessage
  | TFileTreeChangedMessage
  | TPortsChangedMessage
  | TInstancesUpdatedMessage

export type TDetectedPort = {
  port: number
  protocol: TProto
}

export type TPortsResponse = {
  instanceId: string
  portUrlTemplate?: string
  detected: TDetectedPort[]
  exposed: Record<string, TPortConfig>
}

export type TExposePortRequest = {
  port: number
  protocol?: TProto
  instanceId: string
}

export type TExposePortResponse = {
  port: number
  url?: string
  protocol: TProto
}
