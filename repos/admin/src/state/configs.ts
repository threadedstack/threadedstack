import { atomWithReset } from 'jotai/utils'

export type TConfig = {
  id: string
  name: string
  data: Record<string, any>
  teamId?: string
  repoId?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
}

export const configsState = atomWithReset<Record<string, TConfig>>(undefined)
export const activeConfigIdState = atomWithReset<string>(undefined)
