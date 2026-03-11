import type { V1Pod } from '@kubernetes/client-node'
import type { KubeClient } from '@TSB/kube/kubeClient'

import { logger } from '@TSB/utils/logger'

/**
 * Set up K8s pod event watching with cycle listening
 * Adapted from conductor's watch pattern
 *
 * Cycle listening restarts the watch periodically to work around
 * K8s client library bug #596 (watch connections go stale)
 */
export const setupKubeWatcher = (client: KubeClient) => {
  const handlers = {
    added: (pod: V1Pod) => {
      client.hydrateSingle(pod)
    },
    modified: (pod: V1Pod) => {
      client.hydrateSingle(pod)
    },
    deleted: (pod: V1Pod) => {
      client.removeFromCache(pod)
    },
    bookmark: (_pod: V1Pod) => {
      // Keep-alive, no action
    },
    error: (err: any) => {
      logger.error(`KubeEvents Watch error:`, err)
    },
  }

  client.cycleListen(handlers)
}
