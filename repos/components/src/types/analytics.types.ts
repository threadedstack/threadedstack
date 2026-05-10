import type { ReactNode } from 'react'

export type TAnalyticsConfig = {
  key?: string
  host?: string
  debug?: boolean
  disabled?: boolean
}

export type TAnalyticsProvider = {
  children: ReactNode
}

export type TIdentifyProps = {
  name?: string
  orgId?: string
  email?: string
  userId?: string
}
