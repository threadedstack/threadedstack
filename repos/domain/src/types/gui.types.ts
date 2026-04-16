import type { TGuiNodeType } from '../constants/gui'

export type TJsonComponentNode = {
  type: TGuiNodeType | (string & {})
  props?: Record<string, unknown>
  children?: (TJsonComponentNode | string)[]
}

export type TJsonComponentTree = TJsonComponentNode

export type TGenerativeUIResult = {
  tree: TJsonComponentTree
}

export type TGuiConfig = {
  enabled: boolean
  providerId: string
  model: string
  maxRetries: number
  systemPrompt?: string
}

export type TOrgConfig = {
  guiConfig?: TGuiConfig
}

export type TInteraction =
  | { type: 'ArrowSelect'; selectedIndex: number; currentIndex: number }
  | { type: 'NumberSelect'; selectedIndex: number }
  | { type: 'YesNo'; approved: boolean }
  | { type: 'TextInput'; text: string }
  | { type: 'Keystroke'; key: string }
