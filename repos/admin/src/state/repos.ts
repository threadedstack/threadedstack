import type { Repo } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const reposState = atomWithReset<Record<string, Repo>>(undefined)
export const activeRepoIdState = atomWithReset<string>(undefined)
