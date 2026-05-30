import type { Plan } from '@tdsk/domain'
import { TDSK_CADDY_PX_HOST } from '@TAF/constants/envs'

const apiBase = TDSK_CADDY_PX_HOST.startsWith(`http`)
  ? TDSK_CADDY_PX_HOST
  : `https://${TDSK_CADDY_PX_HOST}`

export const fetchPlans = async (): Promise<Plan[]> => {
  const resp = await fetch(`${apiBase}/_/subscriptions/plans`)
  if (!resp.ok) {
    const text = await resp.text().catch(() => `(no body)`)
    throw new Error(`Failed to fetch plans: ${resp.status} ${resp.statusText} - ${text}`)
  }

  const body = await resp.json()
  return body.data ?? []
}
