import { exists } from '@keg-hub/jsutils/exists'
import { setQuickstartOpen, getQuickstartOpen } from '@TAF/state/accessors'

export const toggleQuickStart = (status?: boolean) => {
  const open = exists(status) ? status : !getQuickstartOpen()
  setQuickstartOpen(open)
}
