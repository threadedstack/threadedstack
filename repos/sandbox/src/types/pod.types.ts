import type { Sandbox, TKubeSandboxConfig, TPlaceholderMap } from '@tdsk/domain'

export type TPodEgressOpts = {
  initImage?: string
  serviceIp?: string
  servicePort: number
  serviceName: string
  certSecretName: string
}

export type TSkillsVolumeOpts = {
  mountPath: string
  configMapName: string
  files: Array<{ key: string; path: string }>
}

export type TBuildPodOpts = {
  orgId: string
  userId: string
  sandbox: Sandbox
  projectId?: string
  namespace?: string
  runtimeClassName?: string
  nodeSelector?: Record<string, string>
  egressOpts: TPodEgressOpts
  imagePullSecrets?: string[]
  placeholders: TPlaceholderMap
  skillsVolume?: TSkillsVolumeOpts
  extraEnv?: Record<string, string>
}

export type TBuildPodMeta = {
  orgId: string
  userId: string
  podName: string
  sandbox: Sandbox
  subdomain: string
  projectId?: string
  config: TKubeSandboxConfig
  placeholders: TPlaceholderMap
}
