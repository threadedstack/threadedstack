import type { User, Team, Repo, Provider } from '@tdsk/domain'

import { createStore } from 'jotai'
import { EThemeType } from '@TAF/types'
import { userState } from '@TAF/state/user'
import { providersState } from '@TAF/state/providers'
import { themeTypeState, defThemeType } from '@TAF/state/theme'
import { sidebarOpenState, defSidebarOpen } from '@TAF/state/app'
import { teamsState, activeTeamIdState } from '@TAF/state/teams'
import { reposState, activeRepoIdState } from '@TAF/state/repos'

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

export const getTeams = () => store.get(teamsState)
export const resetTeams = () => store.set(teamsState, undefined)
export const setTeams = (teams:Record<string, Team>) => store.set(teamsState, teams)

export const getActiveTeamId = () => store.get(activeTeamIdState)
export const resetActiveTeamId = () => store.set(activeTeamIdState, undefined)
export const setActiveTeamId = (id:string) => store.set(activeTeamIdState, id)

export const getRepos = () => store.get(reposState)
export const resetRepos = () => store.set(reposState, undefined)
export const setRepos = (repos:Record<string, Repo>) => store.set(reposState, repos)

export const getActiveRepoId = () => store.get(activeRepoIdState)
export const resetActiveRepoId = () => store.set(activeRepoIdState, undefined)
export const setActiveRepoId = (id:string) => store.set(activeRepoIdState, id)

export const getProviders = () => store.get(providersState)
export const resetProviders = () => store.set(providersState, undefined)
export const setProviders = (providers:Record<string, Provider>) => store.set(providersState, providers)
