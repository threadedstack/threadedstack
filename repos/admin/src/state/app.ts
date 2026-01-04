import { atomWithReset } from 'jotai/utils'

export const defSidebarOpen = true
export const sidebarOpenState = atomWithReset<boolean>(defSidebarOpen)
