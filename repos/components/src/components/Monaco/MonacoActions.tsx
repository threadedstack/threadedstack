import type { ReactNode } from 'react'
import type { TAccordionAction, TSelectItem } from '@TSC/types'

import { LangSelect } from '@TSC/components/Monaco/LangSelect'
import { AccordionActions } from '@TSC/components/Accordion/AccordionActions'
import {
  MonacoActionsHeader,
  MonacoActionsContainer,
} from '@TSC/components/Monaco/Monaco.styles'

export type TMonacoActions = {
  language?: string
  title?: ReactNode
  showActions?: boolean
  hideLanguage?: boolean
  defaultLanguage?: string
  actions?: TAccordionAction[]
  onLangChange?: (item: TSelectItem) => void
}

export const MonacoActions = (props: TMonacoActions) => {
  const {
    title,
    actions,
    language,
    hideLanguage,
    defaultLanguage,
    showActions = true,
    onLangChange,
  } = props

  return (
    <MonacoActionsContainer className='tdsk-editor-actions-container'>
      {title && (
        <MonacoActionsHeader className='tdsk-editor-actions-header'>
          {title}
        </MonacoActionsHeader>
      )}
      {(!hideLanguage && (defaultLanguage || language) && onLangChange && (
        <LangSelect
          onChange={onLangChange}
          language={language || defaultLanguage}
        />
      )) ||
        null}
      {showActions && (
        <AccordionActions
          show={showActions}
          actions={actions}
        />
      )}
    </MonacoActionsContainer>
  )
}
