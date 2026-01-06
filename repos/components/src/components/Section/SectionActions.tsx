import type { TSectionAction } from '@TSC/types'

import { cls } from '@keg-hub/jsutils/cls'
import {
  SectionActionSep,
  SectionActionButton,
  SectionActionContainer,
  SectionActionsContainer,
  SectionActionIconButton,
} from '@TSC/components/Section/SectionActions.styles'

export type TSectionActionComp = TSectionAction & {}

export const SectionAction = (props: TSectionActionComp) => {
  const {
    text,
    info,
    data,
    color,
    hidden,
    variant,
    content,
    onClick,
    editing,
    loading,
    children,
    inactive,
    disabled,
    onChange,
    onOpenInfo,
    onCloseInfo,
    separatorAfter,
    separatorBefore,
    ...rest
  } = props

  if (inactive) return null

  return (
    <SectionActionContainer
      className={cls(
        `tdsk-section-action-container`,
        hidden && `hidden`,
        separatorAfter && `separator-after`,
        separatorBefore && `separator-before`
      )}
    >
      {separatorBefore && <SectionActionSep className='separator-before' />}
      {content ? (
        content
      ) : text ? (
        <SectionActionButton
          {...rest}
          onClick={onClick}
          color={color as any}
          variant={variant as any}
          disabled={disabled || loading}
        >
          {text}
        </SectionActionButton>
      ) : (
        <SectionActionIconButton
          {...rest}
          onClick={onClick}
          color={color as any}
          variant={variant as any}
          disabled={disabled || loading}
        />
      )}
      {separatorAfter && <SectionActionSep className='separator-after' />}
    </SectionActionContainer>
  )
}

export type TSectionActions = {
  actions?: TSectionAction[]
}

export const SectionActions = (props: TSectionActions) => {
  const { actions } = props

  return (
    <SectionActionsContainer className={cls(`tdsk-section-section-actions-container`)}>
      {actions.map((action) => {
        return (
          !action.hidden && (
            <SectionAction
              {...action}
              key={(action?.key || action?.id || action?.name || action?.text) as string}
            />
          )
        )
      })}
    </SectionActionsContainer>
  )
}
