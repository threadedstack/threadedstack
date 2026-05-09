import type { TSandboxSyncDefaults } from './sync.types'
import type { TGuiConfig } from './gui.types'

import { ELLMProviderBrand } from './ai.types'

/**
 * Subset of LLM provider brands that have sandbox env var mappings, plus composite
 * auth-method variants (e.g. amazon-bedrock:bearer). This enum is intentionally a
 * SUBSET of ELLMProviderBrand — only brands with entries in RuntimeProviderEnvMap need
 * to appear here. When adding a new LLM provider to ELLMProviderBrand, also add it here
 * if the sandbox should support injecting its credentials.
 */
export enum ERuntimeBrand {
  zai = ELLMProviderBrand.zai,
  custom = ELLMProviderBrand.custom,
  ollama = ELLMProviderBrand.ollama,
  openai = ELLMProviderBrand.openai,
  google = ELLMProviderBrand.google,
  anthropic = ELLMProviderBrand.anthropic,
  openrouter = ELLMProviderBrand.openrouter,
  googleVertex = ELLMProviderBrand.googleVertex,
  amazonBedrock = ELLMProviderBrand.amazonBedrock,
  amazonBedrockBearer = `${ELLMProviderBrand.amazonBedrock}:bearer`,
  ollamaCloud = `${ELLMProviderBrand.ollama}:cloud`,
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
 * Brand key can be a plain TLLMProviderBrand or a composite key like 'amazon-bedrock:bearer'
 * for auth method variants. resolveProviderEnv builds the composite key at runtime.
 */
export type TRuntimeProviderEnvMap = Record<
  TSandboxRuntimeId,
  Partial<Record<ERuntimeBrand, TRuntimeEnvVar[]>>
>

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
  geminiCli = `gemini-cli`,
  claudeCode = `claude-code`,
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
  gitRepo?: string
  workdir?: string
  gitBranch?: string
  command?: string[]
  sshEnabled?: boolean
  /** Shell script that runs after container start + built-in setup, before sandbox is "ready" */
  initScript?: string
  secretIds?: string[]
  /** Shell command executed by `tsa run` after SSH connect to launch the AI tool */
  runtimeCommand?: string
  defaultRuntime?: string
  gitTokenSecretId?: string
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
  podName: string
  sandboxId: string
  sessionId: string
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
  SandboxStopping = `sandbox-stopping`,
  SessionsUpdated = `sessions-updated`,
  PermissionResponse = `permission-response`,
}

export type TSandboxConnectResponse = {
  alias?: string
  workdir: string
  command: string
  podName: string
  password: string
  sandboxId: string
  shellToken?: string
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
