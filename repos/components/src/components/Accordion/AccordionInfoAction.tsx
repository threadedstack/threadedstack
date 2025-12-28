import type { CSSProperties, ReactNode } from 'react'

import {
  AccordionInfoTip,
  AccordionInfoIcon,
  AccordionActionSep,
  AccordionInfoContainer,
  AccordionActionContainer,
} from '@TSC/components/Accordion/AccordionActions.styles'
import { cls } from '@keg-hub/jsutils/cls'

export type AccordionInfoAction = {
  info?: ReactNode
  Icon?: ReactNode
  className?: string
  sx?: CSSProperties
  inactive?: boolean
  children?: ReactNode
  separatorAfter?: boolean
  separatorBefore?: boolean
  onClick?: (evt: any) => any
  onOpen?: (evt: any, ...args: any[]) => any
  onClose?: (evt: any, ...args: any[]) => any
}

export const AccordionInfoAction = (props: AccordionInfoAction) => {
  const {
    sx,
    info,
    onOpen,
    onClose,
    onClick,
    inactive,
    children,
    className,
    separatorAfter,
    separatorBefore,
    Icon = <AccordionInfoIcon />,
  } = props

  if (inactive) return null

  return (
    <AccordionActionContainer
      sx={sx}
      className={cls(
        className,
        `tdsk-accordion-action-container`,
        separatorAfter && `separator-after`,
        separatorBefore && `separator-before`
      )}
    >
      {separatorBefore && <AccordionActionSep className='separator-before' />}
      <AccordionInfoTip
        className='tdsk-section-info-tip'
        Icon={Icon}
        onOpen={onOpen}
        onClick={onClick}
        onClose={onClose}
        Info={
          <AccordionInfoContainer className='tdsk-section-info-container'>
            {info}
            {children}
          </AccordionInfoContainer>
        }
      />
      {separatorAfter && <AccordionActionSep className='separator-after' />}
    </AccordionActionContainer>
  )
}
