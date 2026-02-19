import { useMemo, useCallback } from 'react'
import { HooksService } from '@TRL/services/hooks'
import type { THooksConfig } from '@TRL/types'

export function useLifecycleHooks(config?: THooksConfig) {
  const service = useMemo(() => new HooksService(config || {}), [config])

  const run = useCallback(
    async (name: keyof THooksConfig, env: Record<string, string> = {}) => {
      await service.run(name, env)
    },
    [service]
  )

  return { run }
}
