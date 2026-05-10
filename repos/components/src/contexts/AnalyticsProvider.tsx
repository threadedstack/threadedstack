import type { TAnalyticsProvider } from '@TSC/types/analytics.types'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { MemoChildren } from '@TSC/components/MemoChildren'

export const AnalyticsProvider = ({ children }: TAnalyticsProvider) => {
  return (
    <PostHogProvider client={posthog}>
      <MemoChildren>{children}</MemoChildren>
    </PostHogProvider>
  )
}
