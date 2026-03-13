import type { RefObject } from 'react'
import type { TAccordionAction } from '@TSC/types/accordion.types'
import type { OnMount, Monaco, EditorProps } from '@monaco-editor/react'

export type TMonEditor = Parameters<OnMount>[0]
export type TMonEditorRef = RefObject<TMonEditor>
export type TMonacoRef = RefObject<Monaco>
export type TMonacoCB = (monaco: Monaco) => void
export type TMonEditorLangCB = (language: string) => void
export type TMonEditorCB = (editor: TMonEditor, monaco: Monaco) => void

export enum EEditorActionKey {
  clearText = `clear-text`,
  copyToClip = `copy-to-clip`,
}

export type TMonacoOpts = EditorProps[`options`]

export type THMonaco = EditorProps & {
  id?: string
  disabled?: boolean
  hideCopy?: boolean
  hideClear?: boolean
  placeholder?: string
  onMount?: TMonEditorCB
  monacoRef?: TMonacoRef
  actionsBefore?: boolean
  editorRef?: TMonEditorRef
  onBlurText?: TMonEditorCB
  onFocusText?: TMonEditorCB
  onBeforeMount?: TMonacoCB
  actions?: TAccordionAction[]
  themeLight?: `vs` | `r-light`
  themeDark?: `vs-dark` | `r-dark`
  onLangChange?: TMonEditorLangCB
  onCopy?: (value: string, error?: string) => void
}

export type TScratchPadEditor = {
  id: string
  content: string
  language: string
}
