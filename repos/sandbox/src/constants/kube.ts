import { EContainerState } from '@tdsk/domain'

// 10 minutes — K8s client bug #596 workaround
export const PodCycleInterval = 10 * 60 * 1000

export const DefaultInitImage =
  process.env.TDSK_SB_INIT_IMAGE || `ghcr.io/threadedstack/tdsk-init`

export const ContainerStatesSet = new Set<string>(Object.values(EContainerState))
export const InClusterNamespacePath = `/var/run/secrets/kubernetes.io/serviceaccount/namespace`

export const PodLabelKeys = {
  orgId: `tdsk.app/org-id`,
  userId: `tdsk.app/user-id`,
  managed: `tdsk.app/managed`,
  sandboxId: `tdsk.app/sandbox-id`,
  projectId: `tdsk.app/project-id`,
} as const

export const PodAnnotationKeys = {
  ports: `tdsk.app/ports`,
  subdomain: `tdsk.app/subdomain`,
  placeholders: `tdsk.app/placeholders`,
} as const

export const PodManagedSelector = `${PodLabelKeys.managed}=true`

export const KubeSBPrefix = `sb`
