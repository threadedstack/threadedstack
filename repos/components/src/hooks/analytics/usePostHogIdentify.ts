import { useEffect, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'
import type { TIdentifyProps } from '@TSC/types/analytics.types'

export const usePostHogIdentify = (props: TIdentifyProps) => {
  const posthog = usePostHog()
  const { userId, email, name, orgId } = props
  const prevUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!posthog) return

    if (userId) {
      posthog.identify(userId, {
        ...(email && { email }),
        ...(name && { name }),
      })
      prevUserId.current = userId
    } else if (prevUserId.current) {
      posthog.reset()
      prevUserId.current = undefined
    }
  }, [posthog, userId, email, name])

  useEffect(() => {
    if (!posthog || !orgId) return
    posthog.group(`company`, orgId)
  }, [posthog, orgId])
}
