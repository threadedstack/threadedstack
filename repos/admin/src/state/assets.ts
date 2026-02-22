import type { Asset } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const assetsState = atomWithReset<Record<string, Record<string, Asset>>>(undefined)
export const activeAssetIdState = atomWithReset<string>(undefined)

// Derived: org-level assets
export const orgAssetsState = atom((get) => get(assetsState)?.['org'])

// Derived: project-level assets
export const projectAssetsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(assetsState)?.[projectId] : undefined
})
