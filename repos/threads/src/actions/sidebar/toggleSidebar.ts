import { setSidebarOpen } from '@TTH/state/accessors'
import { store } from '@TTH/state/accessors'
import { sidebarOpenState } from '@TTH/state/app'

export const openSidebar = () => setSidebarOpen(true)
export const closeSidebar = () => setSidebarOpen(false)
export const toggleSidebar = () => store.set(sidebarOpenState, (prev) => !prev)
