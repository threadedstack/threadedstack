import type { ReactNode } from 'react'
import type { THMonaco } from '@TSC/types'

import { cls } from '@keg-hub/jsutils/cls'
import { gutter } from '@TSC/theme/gutter'
import MonEditor from '@monaco-editor/react'
import { Loading } from '@TSC/components/Loading'
import { useMonaco } from '@TSC/hooks/monaco/useMonaco'
import { MonacoActions } from '@TSC/components/Monaco/MonacoActions'
import { MonacoClass, MonacoPlaceholderClass } from '@TSC/constants/monaco'
import { MonacoContainer, MonacoPlaceholder } from '@TSC/components/Monaco/Monaco.styles'

export type TMonaco = THMonaco & {
  title?: ReactNode
  content?: string
  hidden?: boolean
  required?: boolean
  disabled?: boolean
  className?: string
  editorCls?: string
  noLineNum?: boolean
  showActions?: boolean
  hideActions?: boolean
  hideLanguage?: boolean
}

export const Monaco = (props: TMonaco) => {
  const {
    value,
    theme,
    actions,
    options,
    onMount,
    onChange,
    language,
    onLangChange,
    defaultValue,
    onBeforeMount,
    defaultLanguage,
  } = useMonaco(props)

  return (
    <MonacoContainer
      id={props.id}
      className={cls(
        MonacoClass,
        props.className,
        props.hidden && `hidden`,
        props.required && `required`,
        props.noLineNum && `no-editor-line-num`
      )}
    >
      {!props.hideActions && (
        <MonacoActions
          actions={actions}
          title={props.title}
          language={language}
          onLangChange={onLangChange}
          showActions={props.showActions}
          hideLanguage={props.hideLanguage}
          defaultLanguage={defaultLanguage}
        />
      )}
      {props.placeholder && (
        <MonacoPlaceholder
          sx={{ display: (value || defaultValue)?.trim() ? `none` : `initial` }}
          className={cls(
            MonacoPlaceholderClass,
            props.hidden && `hidden`,
            options.lineNumbers !== `off` && `line-numbers`
          )}
        >
          {props.placeholder}
        </MonacoPlaceholder>
      )}
      <MonEditor
        theme={theme}
        value={value}
        options={options}
        onMount={onMount}
        onChange={onChange}
        language={language}
        beforeMount={onBeforeMount}
        defaultValue={defaultValue}
        defaultLanguage={defaultLanguage}
        className={cls(`tdsk-editor`, props.editorCls, props.hidden && `hidden`)}
        loading={
          <Loading
            full
            message={`Editor loading...`}
            sx={{ marginTop: gutter.dpx }}
            messageSx={{ color: `text.primary` }}
          />
        }
      />
    </MonacoContainer>
  )
}
