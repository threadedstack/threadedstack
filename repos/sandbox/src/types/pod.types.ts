import type { Sandbox } from '@tdsk/domain'
import type { TKubeSandboxConfig, TPlaceholderMap } from '@tdsk/domain'

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
  projectId: string
  namespace?: string
  egressOpts: TPodEgressOpts
  placeholders: TPlaceholderMap
}

export type TBuildPodMeta = {
  orgId: string
  userId: string
  podName: string
  sandbox: Sandbox
  projectId: string
  subdomain: string
  config: TKubeSandboxConfig
  placeholders: TPlaceholderMap
}
