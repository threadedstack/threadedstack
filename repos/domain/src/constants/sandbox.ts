import { EImagePullPolicy } from '@TDM/types'

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
