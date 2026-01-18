export type TPayPlans = Record<string, string>

type TTimeInSeconds = number
type TNumberOfMonths = number
type TPlanCostInDollars = number
type TTotalAmountAllowed = number
type TNumberOfUserInvites = number

/**
 * Initial raw metadata object returned from a payments API  (i.e. polar API)
 */
export type TPayPlanRaw = {
  price: string
  runtime: string
  threads: string
  members: string
  messages: string
  projects: string
  endpoints: string
  retention: string
  org_secrets: string
  organizations: string
  function_calls: string
  project_secrets: string
}

/**
 * Runtime Metadata object created from the TPayPlanRaw but with number values
 */
export type TPayPlanMeta = {
  price: TPlanCostInDollars
  runtime: TTimeInSeconds
  retention: TNumberOfMonths
  threads: TTotalAmountAllowed
  members: TNumberOfUserInvites
  functionCalls: TTimeInSeconds
  messages: TTotalAmountAllowed
  projects: TTotalAmountAllowed
  endpoints: TTotalAmountAllowed
  orgSecrets: TTotalAmountAllowed
  organizations: TTotalAmountAllowed
  projectSecrets: TTotalAmountAllowed
}
