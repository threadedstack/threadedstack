import { readFileSync } from 'fs'
import { logger } from '@TSB/utils/logger'
import { InClusterNamespacePath } from '@TSB/constants/kube'

const loadNamespace = (): string | undefined => {
  try {
    return readFileSync(InClusterNamespacePath, `utf-8`).trim()
  } catch (err: any) {
    logger.error(`[KubeClient] Error loading namespace from path`, err)
    return undefined
  }
}

export const getKubeNS = (namespace?: string) => {
  if (namespace) return namespace

  const loaded = loadNamespace()
  if (loaded) return loaded

  logger.warn(`[KubeClient] Using default namespace`)
  return `default`
}
