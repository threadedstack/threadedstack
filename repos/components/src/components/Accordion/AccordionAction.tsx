import type { TAccordionAction } from '@TSC/types'

import { cls } from '@keg-hub/jsutils/cls'
import { AccordionInfoAction } from '@TSC/components/Accordion/AccordionInfoAction'
import {
  AccordionActionButton,
  AccordionActionContainer,
  AccordionActionIconButton,
  AccordionActionSep,
} from '@TSC/components/Accordion/AccordionActions.styles'

export type TAccordionActionComp = TAccordionAction & {}

export const AccordionAction = (props: TAccordionActionComp) => {
  const {
    text,
    info,
    data,
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

  return info ? (
    <AccordionInfoAction
      info={info}
      onClick={onClick}
      inactive={inactive}
      onOpen={onOpenInfo}
      onClose={onCloseInfo}
      separatorAfter={separatorAfter}
      separatorBefore={separatorBefore}
    />
  ) : (
    <AccordionActionContainer
      className={cls(
        `tdsk-accordion-action-container`,
        separatorAfter && `separator-after`,
        separatorBefore && `separator-before`
      )}
    >
      {separatorBefore && <AccordionActionSep className='separator-before' />}
      {content ? (
        content
      ) : text ? (
        <AccordionActionButton
          {...rest}
          onClick={onClick}
          disabled={disabled || loading}
        >
          {text}
        </AccordionActionButton>
      ) : (
        <AccordionActionIconButton
          {...rest}
          onClick={onClick}
          disabled={disabled || loading}
        />
      )}
      {separatorAfter && <AccordionActionSep className='separator-after' />}
    </AccordionActionContainer>
  )
}
