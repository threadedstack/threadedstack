import { proxy } from '@TBE/endpoints/proxy'
import { accounts } from '@TBE/endpoints/accounts'
import { residentDispatch } from '@TBE/endpoints/agents/dispatchAgentActions'

export const endpoints = {
  proxy,
  // MUST register before `accounts`: dispatch authenticates via the resident
  // token (residentAuth), not the accounts-level user authentication.
  residentDispatch,
  accounts,
}
