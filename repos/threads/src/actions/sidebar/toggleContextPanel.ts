import { getContextPanelOpen, setContextPanelOpen } from '@TTH/state/accessors'

export const toggleContextPanel = () => {
  setContextPanelOpen(!getContextPanelOpen())
}
