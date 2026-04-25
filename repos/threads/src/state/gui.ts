import type { TDocument, TFeedEvent, TViewportMode } from '@TTH/types'
import type { SessionEngine } from '@TTH/services/gui/engine/sessionEngine'

import { atomWithReset } from 'jotai/utils'

export const guiASTState = atomWithReset<Map<string, TDocument>>(new Map())
export const guiFeedState = atomWithReset<Map<string, TFeedEvent[]>>(new Map())
export const guiModeState = atomWithReset<Map<string, TViewportMode>>(new Map())
export const guiEngineState = atomWithReset<Map<string, SessionEngine>>(new Map())
