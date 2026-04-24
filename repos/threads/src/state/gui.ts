import type { TDocument, TFeedEvent, TViewportMode } from '@TTH/types/ast.types'
import type { SessionEngine } from '@TTH/engine/sessionEngine'

import { atomWithReset } from 'jotai/utils'

export const sessionASTState = atomWithReset<Map<string, TDocument>>(new Map())
export const sessionFeedState = atomWithReset<Map<string, TFeedEvent[]>>(new Map())
export const sessionModeState = atomWithReset<Map<string, TViewportMode>>(new Map())
export const sessionEngineState = atomWithReset<Map<string, SessionEngine>>(new Map())
