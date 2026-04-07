import type { TKubeSandboxConfig, TSandboxRuntimeId } from '@TDM/types'

import { EImagePullPolicy, ESandboxRuntime } from '@TDM/types'

export const SBImagePullPolicyOptions = [
  { value: EImagePullPolicy.Never, label: EImagePullPolicy.Never },
  { value: EImagePullPolicy.Always, label: EImagePullPolicy.Always },
  { value: EImagePullPolicy.IfNotPresent, label: EImagePullPolicy.IfNotPresent },
]

export const SBRuntimeOptions = [
  { value: `node`, label: `Node.js` },
  { value: `python`, label: `Python` },
]

export const SBImagePresets = [
  { label: `Codex`, value: `tdsk-sandbox-codex` },
  { label: `Claude Code`, value: `tdsk-sandbox-claude` },
  { label: `OpenCode`, value: `tdsk-sandbox-opencode` },
]

export const SandboxRuntimeOptions = [
  { value: ESandboxRuntime.claudeCode, label: `Claude Code` },
  { value: ESandboxRuntime.codex, label: `Codex` },
  { value: ESandboxRuntime.openCode, label: `OpenCode` },
  { value: ESandboxRuntime.custom, label: `Custom` },
]

/**
 * Maps each built-in runtime to its container start command and runtime command.
 * - command/args: what the container runs on startup (SSH + idle wait)
 * - runtimeCommand: what `tsa run` executes after SSH connect
 * - initScript: default setup script for this runtime
 */
export const SandboxRuntimeConfigs: Record<
  TSandboxRuntimeId,
  {
    command?: string[]
    args?: string[]
    runtimeCommand?: string
    initScript?: string
  }
> = {
  [ESandboxRuntime.claudeCode]: {
    runtimeCommand: `claude`,
    initScript: `echo "Claude Code sandbox ready"`,
  },
  [ESandboxRuntime.codex]: {
    runtimeCommand: `codex`,
    initScript: `echo "Codex sandbox ready"`,
  },
  [ESandboxRuntime.openCode]: {
    runtimeCommand: `opencode`,
    initScript: `echo "OpenCode sandbox ready"`,
  },
  [ESandboxRuntime.custom]: {},
}

const DefaultSandboxImage = `tdsk/sandbox:latest`

const DefaultResources = {
  limits: { cpu: `2`, memory: `4Gi` },
  requests: { cpu: `500m`, memory: `1Gi` },
}

/**
 * Pre-configured sandbox configs seeded per org on creation.
 * Each creates a real sandbox row that is immediately startable.
 */
export const SandboxPresets: Record<
  TSandboxRuntimeId,
  {
    name: string
    description: string
    config: Partial<TKubeSandboxConfig>
  }
> = {
  [ESandboxRuntime.claudeCode]: {
    name: `Claude Code`,
    description: `Anthropic Claude Code AI assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      image: DefaultSandboxImage,
      resources: DefaultResources,
      runtime: ESandboxRuntime.claudeCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.claudeCode].initScript,
    },
  },
  [ESandboxRuntime.codex]: {
    name: `Codex`,
    description: `OpenAI Codex AI coding assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      image: DefaultSandboxImage,
      resources: DefaultResources,
      runtime: ESandboxRuntime.codex,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.codex].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.codex].initScript,
    },
  },
  [ESandboxRuntime.openCode]: {
    name: `OpenCode`,
    description: `OpenCode AI coding assistant`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      image: DefaultSandboxImage,
      resources: DefaultResources,
      runtime: ESandboxRuntime.openCode,
      runtimeCommand: SandboxRuntimeConfigs[ESandboxRuntime.openCode].runtimeCommand,
      initScript: SandboxRuntimeConfigs[ESandboxRuntime.openCode].initScript,
    },
  },
  [ESandboxRuntime.custom]: {
    name: `Base`,
    description: `Base sandbox with SSH — bring your own runtime`,
    config: {
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      image: DefaultSandboxImage,
      resources: DefaultResources,
      runtime: ESandboxRuntime.custom,
    },
  },
}
