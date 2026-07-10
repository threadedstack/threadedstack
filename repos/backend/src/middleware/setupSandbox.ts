import type { TApp } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'

/**
 * Sandbox lifecycle bootstrap. The MITM egress proxy is NOT started here — it
 * runs as the standalone `tdsk-egress` deployment (see src/egress.ts) so a
 * backend deploy never restarts the egress path. Sandbox pods DNAT to a ready
 * egress pod's IP, resolved per launch in SandboxService.startPod.
 */
export const setupSandbox = async (app: TApp) => {
  const kube = await SandboxService.initKube(app)

  const cleanup = () => {
    try {
      kube?.cleanup?.()
    } catch (err) {
      logger.error(`[Sandbox] KubeClient cleanup failed:`, (err as Error).message)
    }
  }

  process.on(`SIGTERM`, cleanup)
  process.on(`SIGINT`, cleanup)
}
