export type TPayPlans = Record<string, string>

export type TParsedPayPlans = {
  priceIds: TPayPlans
  seatPriceIds: TPayPlans
}

export enum ESubscriptionTier {
  free = `free`,
  solo = `solo`,
  pro = `pro`,
  team = `team`,
}
export type TSubscriptionTier = `${ESubscriptionTier}`

export enum ESubscriptionStatus {
  active = `active`,
  canceled = `canceled`,
  past_due = `past_due`,
  incomplete = `incomplete`,
  trialing = `trialing`,
}
export type TSubscriptionStatus = `${ESubscriptionStatus}`

export type TPlanLimits = {
  organizations: number
  projects: number
  compute: number
  threads: number
  messages: number
  endpoints: number
  secrets: number
  retention: number
  seats: number
  additionalSeats: boolean
  sandboxSessions: number
}
