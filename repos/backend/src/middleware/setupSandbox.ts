import type { TApp } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { EgressProxy } from '@TBE/services/proxy/egress'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'

export const setupSandbox = async (app: TApp) => {
  const podIp = SandboxService.getPodIp()
  if (podIp) app.locals.config.egress.serviceIp = podIp

  const kube = await SandboxService.initKube(app)
  const egressProxy = await EgressProxy.init(app)

  const cleanup = () => {
    try {
      kube?.cleanup?.()
    } catch (err) {
      logger.error(`[Sandbox] KubeClient cleanup failed:`, (err as Error).message)
    }

    try {
      egressProxy?.stop?.()
    } catch (err) {
      logger.error(`[Sandbox] EgressProxy cleanup failed:`, (err as Error).message)
    }
  }

  process.on(`SIGTERM`, cleanup)
  process.on(`SIGINT`, cleanup)
}
