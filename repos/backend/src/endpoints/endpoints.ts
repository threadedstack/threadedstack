import { proxy } from '@TBE/endpoints/proxy'
import { accounts } from '@TBE/endpoints/accounts'
import { residentAuthorFunction } from '@TBE/endpoints/agents/authorFunction'
import { residentDispatch } from '@TBE/endpoints/agents/dispatchAgentActions'

export const endpoints = {
  proxy,
  // MUST register before `accounts`: dispatch + author-function authenticate
  // via the resident token (residentAuth), not the accounts-level user
  // authentication.
  residentDispatch,
  residentAuthorFunction,
  accounts,
}
