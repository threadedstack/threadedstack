import { atomWithReset } from 'jotai/utils'
import type { TDocument, TFeedEvent, TViewportMode } from '@TTH/ast'
import type { SessionEngine } from '@TTH/engine/sessionEngine'

export const sessionASTAtom = atomWithReset<Map<string, TDocument>>(new Map())
export const sessionFeedAtom = atomWithReset<Map<string, TFeedEvent[]>>(new Map())
export const sessionModeAtom = atomWithReset<Map<string, TViewportMode>>(new Map())
export const sessionEngineAtom = atomWithReset<Map<string, SessionEngine>>(new Map())
