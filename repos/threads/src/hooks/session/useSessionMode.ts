import { ESandboxMode } from '@TTH/types'
import { useGuiModes } from '@TTH/state/selectors'

export const useSessionMode = (sessionId: string) => {
  const [modeMap] = useGuiModes()
  return modeMap.get(sessionId) ?? ESandboxMode.idle
}
