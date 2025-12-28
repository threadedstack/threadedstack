import type { MutableRefObject } from 'react'
import type { TAccordionAction } from '@TSC/types/accordion.types'
import type { OnMount, Monaco, EditorProps } from '@monaco-editor/react'

export type TMonEditor = Parameters<OnMount>[0]
export type TMonEditorRef = MutableRefObject<TMonEditor>
export type TMonacoRef = MutableRefObject<Monaco>
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
  onMount?: TMonEditorCB
  placeholder?: string
  onBlurText?: TMonEditorCB
  onFocusText?: TMonEditorCB
  onBeforeMount?: TMonacoCB
  actionsBefore?: boolean
  actions?: TAccordionAction[]
  onLangChange?: TMonEditorLangCB
  monacoRef?: MutableRefObject<Monaco>
  editorRef?: MutableRefObject<TMonEditor>
  themeLight?: `vs` | `r-light`
  themeDark?: `vs-dark` | `r-dark`
}

export type TScratchPadEditor = {
  id: string
  content: string
  language: string
}
