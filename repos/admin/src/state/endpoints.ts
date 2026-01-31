import type { Endpoint } from '@tdsk/domain'
import type { TAgentFormState, TFaasFormState, TProxyFormState } from '@TAF/types'

import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { DefFaasState, DefProxyState, DefAgentState } from '@TAF/constants/endpoints'

export const endpointsState = atomWithReset<Record<string, Endpoint>>(undefined)
export const activeEndpointIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `endpoints` && part))
)

export const faasFormState = atomWithReset<TFaasFormState>(DefFaasState)
export const proxyFormState = atomWithReset<TProxyFormState>(DefProxyState)
export const agentFormState = atomWithReset<TAgentFormState>(DefAgentState)
