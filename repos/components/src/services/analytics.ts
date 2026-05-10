import posthog from 'posthog-js'
import type { TAnalyticsConfig } from '@TSC/types/analytics.types'

export const initAnalytics = (config: TAnalyticsConfig) => {
  const { key, host, debug, disabled } = config
  if (disabled || !key || !host) return

  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: `localStorage+cookie`,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: `[data-ph-mask]`,
    },
    ...(debug && { debug: true }),
  })
}
