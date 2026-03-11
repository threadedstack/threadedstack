import type {
  ISandbox,
  TSandboxConfig,
  TSandboxRuntime,
  ISandboxProvider,
} from '@tdsk/domain'

import { ESandboxType } from '@tdsk/domain'
import { KubeClient } from '@TSB/kube/kubeClient'
import { KubeSandbox } from '@TSB/kube/kubeSandbox'

type TKubeProviderOpts = {
  podName?: string
  namespace?: string
  runtimes?: TSandboxRuntime[]
  defaultRuntime?: string
}

/**
 * Kubernetes sandbox provider — creates sandbox instances backed by K8s pods
 * Pods are persistent workspaces managed separately
 * This provider connects to an existing running pod
 */
export class KubeSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.kubernetes

  async create(config: TSandboxConfig): Promise<ISandbox> {
    const kubeConfig = config.options as TKubeProviderOpts | undefined

    if (!kubeConfig?.podName) {
      throw new Error(
        `KubeSandboxProvider.create requires options.podName — pods are created via SandboxService`
      )
    }

    const client = new KubeClient({
      namespace: kubeConfig.namespace,
    })

    return new KubeSandbox(
      client,
      kubeConfig.podName,
      kubeConfig.runtimes,
      kubeConfig.defaultRuntime
    )
  }
}
