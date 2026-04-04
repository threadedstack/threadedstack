import type { Sandbox, TKubeSandboxConfig, TPlaceholderMap } from '@tdsk/domain'

export type TPodEgressOpts = {
  servicePort: number
  serviceName: string
  serviceIp?: string
  certSecretName: string
}

export type TBuildPodOpts = {
  orgId: string
  userId: string
  sandbox: Sandbox
  projectId?: string
  namespace?: string
  egressOpts: TPodEgressOpts
  placeholders: TPlaceholderMap
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
