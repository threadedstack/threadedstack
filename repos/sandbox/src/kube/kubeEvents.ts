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
  const hydrate = (pod: V1Pod) => client.hydrateSingle(pod)

  const handlers = {
    added: hydrate,
    modified: hydrate,
    deleted: (pod: V1Pod) => client.removeFromCache(pod),
    bookmark: () => {},
    error: (err: any) => {
      logger.error(`KubeEvents Watch error:`, err)
    },
  }

  client.cycleListen(handlers)
}
