import type { Endpoint } from '@tdsk/domain'
import type { TAgentFormState, TFaasFormState, TProxyFormState } from '@TAF/types'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { DefFaasState, DefProxyState, DefAgentState } from '@TAF/constants/endpoints'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const endpointsState =
  atomWithReset<Record<string, Record<string, Endpoint>>>(undefined)
export const activeEndpointIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `endpoints` && part))
)

// Derived: auto-filters to active project
export const projectEndpointsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(endpointsState)?.[projectId] : undefined
})

// Derived: active endpoint (searches all scopes)
export const activeEndpointState = atom((get) => {
  const endpointId = get(activeEndpointIdState)
  if (!endpointId) return undefined

  const all = get(endpointsState)
  if (!all) return undefined

  for (const scope of Object.values(all)) {
    if (scope?.[endpointId]) return scope[endpointId]
  }

  return undefined
})

export const endpointTabsDisabledState = atomWithReset(false)

export const faasFormState = atomWithReset<TFaasFormState>(DefFaasState)
export const proxyFormState = atomWithReset<TProxyFormState>(DefProxyState)
export const agentFormState = atomWithReset<TAgentFormState>(DefAgentState)
