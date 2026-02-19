import { useState, useMemo } from 'react'
import { ConfigService } from '@TRL/services/config'
import type { TReplConfig } from '@TRL/types'

export function useConfig() {
  const [global] = useState(() => ConfigService.loadGlobal())
  const [project] = useState(() => ConfigService.loadProject())
  const config = useMemo(() => ConfigService.merge(global, project), [global, project])

  return { config, global, project }
}
