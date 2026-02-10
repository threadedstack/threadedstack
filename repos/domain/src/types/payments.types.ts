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
  messages: TTotalAmountAllowed
  projects: TTotalAmountAllowed
  endpoints: TTotalAmountAllowed
  orgSecrets: TTotalAmountAllowed
  functionCalls: TTotalAmountAllowed
  organizations: TTotalAmountAllowed
  projectSecrets: TTotalAmountAllowed
}

export enum ESubscriptionTier {
  pro = `pro`,
  free = `free`,
  basic = `basic`,
  developer = `developer`,
}
export type TSubscriptionTier = `${ESubscriptionTier}`

export enum ESubscriptionStatus {
  active = `active`,
  canceled = `canceled`,
  past_due = `past_due`,
  incomplete = `incomplete`,
}
export type TSubscriptionStatus = `${ESubscriptionStatus}`
