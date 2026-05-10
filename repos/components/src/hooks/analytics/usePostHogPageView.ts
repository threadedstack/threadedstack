import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

export const usePostHogPageView = (pathname: string, search?: string) => {
  const posthog = usePostHog()

  useEffect(() => {
    posthog && posthog.capture(`$pageview`, { $current_url: window.location.href })
  }, [posthog, pathname, search])
}
