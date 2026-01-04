import type { User } from '@tdsk/domain'

import { createStore } from 'jotai'
import { EThemeType } from '@TAF/types'
import { userState } from '@TAF/state/user'
import { themeTypeState, defThemeType } from '@TAF/state/theme'
import { sidebarOpenState, defSidebarOpen } from '@TAF/state/app'


export const store = createStore()

export const getThemeType = () => store.get(themeTypeState)
export const resetThemeType = () => store.set(themeTypeState, defThemeType)
export const setThemeType = (type:EThemeType) => store.set(themeTypeState, type)

export const getSidebarOpen = () => store.get(sidebarOpenState)
export const resetSidebarOpen = () => store.set(sidebarOpenState, defSidebarOpen)
export const setSidebarOpen = (status:boolean) => store.set(sidebarOpenState, status)

export const getUser = () => store.get(userState)
export const resetUser = () => store.set(userState, undefined)
export const setUser = (user:User) => store.set(userState, user)
