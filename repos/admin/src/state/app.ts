import type { TRailSectionId } from '@TAF/types'

import { atomWithReset } from 'jotai/utils'

export const waitlistedState = atomWithReset<boolean>(false)

export const defSidebarOpen = true
export const sidebarOpenState = atomWithReset<boolean>(defSidebarOpen)

export const defActiveRailSection: TRailSectionId | null = null
export const activeRailSectionState = atomWithReset<TRailSectionId | null>(
  defActiveRailSection
)
