import type { THMonaco, TMonacoCB, TMonEditor, TSelectItem } from '@TSC/types'
import type { OnMount, Monaco } from '@monaco-editor/react'

import { useRef, useMemo } from 'react'
import { colors } from '@TSC/theme/colors'
import { gutter } from '@TSC/theme/gutter'
import { useTheme } from '@TSC/hooks/theme/useTheme'
import { useInline } from '@TSC/hooks/components/useInline'
import { useMonacoActions } from '@TSC/hooks/monaco/useMonacoActions'
import {
  MonacoOptions,
  CodeLanguages,
  MonacoPlaceholderClass,
} from '@TSC/constants/monaco'

const themes = {
  light: `vs`,
  dark: `vs-dark`,
  rdark: `r-dark`,
  rlight: `r-light`,
}

const useMonacoRefs = (props: THMonaco) => {
  const mRef = useRef<Monaco>()
  const eRef = useRef<TMonEditor>()

  return {
    ...props,
    editorRef: props.editorRef || eRef,
    monacoRef: props.monacoRef || mRef,
  }
}

const setupLangs = async (monaco: Monaco) => {
  return CodeLanguages.map((item) => {
    const lang = item.label
    lang && monaco.languages.register({ id: lang })
    if (item.syntax === false) return
    return lang
  }).filter(Boolean)
}

const setupThemes = (monaco: Monaco) => {
  monaco.editor.defineTheme(`r-dark`, {
    base: `vs-dark` as const,
    inherit: true,
    rules: [] as any,
    colors: {
      [`editor.background`]: colors.editor.dark.rbackground,
      [`editorGutter.background`]: colors.editor.dark.gbackground,
    },
  })
  monaco.editor.defineTheme(`r-light`, {
    base: `vs` as const,
    inherit: true,
    rules: [] as any,
    colors: {
      [`editor.background`]: colors.editor.light.rbackground,
      [`editorGutter.background`]: colors.editor.light.gbackground,
    },
  })
}

const togglePlaceholder = (editor: TMonEditor, show?: boolean) => {
  if (!editor) return

  const element: HTMLElement = document.querySelector(`.${MonacoPlaceholderClass}`)
  element && (element.style.display = show ? `initial` : `none`)
}

const useMonacoTheme = (props: THMonaco) => {
  const theme = useTheme()
  return useMemo(() => {
    return theme.palette.mode === `dark`
      ? props.themeDark || themes.dark
      : props.themeLight || themes.light
  }, [props.themeDark, props.themeLight, theme.palette.mode])
}

const useOnEditorBeforeMount = (props: THMonaco) => {
  const { onBeforeMount } = props

  const onBeforeMountCB: TMonacoCB = (monaco) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      lib: [`es2018`],
      allowNonTsExtensions: true,
      module: monaco.languages.typescript.ModuleKind.ES2015,
      target: monaco.languages.typescript.ScriptTarget.Latest,
    })

    setupThemes(monaco)
    setupLangs(monaco)
    onBeforeMount?.(monaco)
  }

  return onBeforeMountCB
}

const useOnEditorMount = (props: THMonaco) => {
  const { onMount, editorRef, monacoRef, onBlurText, placeholder, onFocusText } = props

  const onMountCB: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    let ignoreEvent = false

    const updateHeight = () => {
      if (ignoreEvent) return

      const editorDomNode = editor.getDomNode()
      if (!editorDomNode) return

      const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
      const lineCount = editor.getModel()?.getLineCount() || 1
      const height = editor.getTopForLineNumber(lineCount + 1) + lineHeight

      try {
        ignoreEvent = true
        editor.layout({ width: editorDomNode.clientWidth, height: height + gutter.h })
      } finally {
        ignoreEvent = false
      }
    }
    ;(placeholder || onFocusText) &&
      editor.onDidFocusEditorText(() => {
        onFocusText?.(editor, monaco)
        placeholder && togglePlaceholder(editor, false)
      })
    ;(placeholder || onBlurText) &&
      editor.onDidBlurEditorText(() => {
        onBlurText?.(editor, monaco)

        placeholder &&
          !Boolean(editor.getValue()?.trim()) &&
          togglePlaceholder(editor, true)
      })

    editor.onDidContentSizeChange(updateHeight)
    updateHeight()

    onMount?.(editor, monaco)
  }

  return onMountCB
}

const useMonacoOpts = (props: THMonaco) => {
  return useMemo(() => {
    return {
      ...MonacoOptions,
      ...(props.disabled ? { readOnly: true } : {}),
      ...props.options,
    }
  }, [props.options, props.disabled])
}

const useOnEditorChange = (props: THMonaco) => {
  const { path, value, onChange, defaultPath, defaultValue } = props

  return {
    path,
    value,
    onChange,
    defaultPath,
    defaultValue,
  }
}

const useOnEditorLanguage = (props: THMonaco) => {
  const { language, onLangChange, defaultLanguage = language } = props

  const onLangChangeCB = useInline((item: TSelectItem) => {
    const lang = item?.label
    if (!lang || lang === language) return
    onLangChange?.(lang)
  })

  return { language, defaultLanguage, onLangChange: onLangChangeCB }
}

export const useMonaco = (_props: THMonaco) => {
  const props = useMonacoRefs(_props)
  const theme = useMonacoTheme(props)
  const options = useMonacoOpts(props)
  const onMount = useOnEditorMount(props)
  const onBeforeMount = useOnEditorBeforeMount(props)
  const { path, value, onChange, defaultPath, defaultValue } = useOnEditorChange(props)
  const { actions } = useMonacoActions({ ...props, value, onChange })
  const { language, defaultLanguage, onLangChange } = useOnEditorLanguage(props)

  return {
    path,
    theme,
    value,
    actions,
    options,
    onMount,
    onChange,
    language,
    defaultPath,
    onLangChange,
    onBeforeMount,
    defaultValue,
    defaultLanguage,
    editorRef: props.editorRef,
    monacoRef: props.monacoRef,
  }
}
