import { proxy } from '@TBE/endpoints/proxy'
import { accounts } from '@TBE/endpoints/accounts'
import { residentAuthorSecret } from '@TBE/endpoints/agents/authorSecret'
import { residentAuthorFunction } from '@TBE/endpoints/agents/authorFunction'
import { residentAuthorEndpoint } from '@TBE/endpoints/agents/authorEndpoint'
import { residentDispatch } from '@TBE/endpoints/agents/dispatchAgentActions'
import { residentRecordsQuery } from '@TBE/endpoints/agents/residentRecordsQuery'

export const endpoints = {
  proxy,
  // MUST register before `accounts`: dispatch + author-function + author-secret
  // + author-endpoint + records reads authenticate via the resident token
  // (residentAuth), not the accounts-level user authentication.
  residentDispatch,
  residentAuthorFunction,
  residentAuthorSecret,
  residentAuthorEndpoint,
  residentRecordsQuery,
  accounts,
}
