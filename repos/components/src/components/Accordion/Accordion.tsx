import type { TAccordionAction } from '@TSC/types'
import type { ComponentProps, ComponentType, CSSProperties, ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { isStr } from '@keg-hub/jsutils/isStr'
import { inherit } from '@TSC/theme/helpers'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { AccordionActions } from '@TSC/components/Accordion/AccordionActions'
import {
  AccordionTitle,
  AccordionHeader,
  AccordionSummary,
  AccordionDetails,
  AccordionIconContainer,
  Accordion as AccordionComp,
} from '@TSC/components/Accordion/Accordion.styles'

export type TAccordion = {
  id?: string
  panel: string
  title?: ReactNode
  header?: ReactNode
  sx?: CSSProperties
  className?: string
  square?: boolean
  elevation?: number
  showHeader?: boolean
  expandIcon?: boolean
  children?: ReactNode
  plainTitle?: boolean
  coloredTitle?: boolean
  expanded: string | false
  disableGutters?: boolean
  openBottomBorder?: boolean
  alwaysShowActions?: boolean
  actions?: TAccordionAction[]
  onChange?: (expanded: boolean) => void
  iconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
}

export const Accordion = (props: TAccordion) => {
  const {
    sx,
    id,
    Icon,
    panel,
    header,
    actions,
    children,
    expanded,
    onChange,
    className,
    iconProps,
    expandIcon,
    title = panel,
    elevation = 0,
    square = false,
    showHeader = true,
    plainTitle = false,
    coloredTitle = true,
    disableGutters = true,
    openBottomBorder = false,
    alwaysShowActions,
  } = props

  const open = expanded === panel

  return (
    <AccordionComp
      sx={sx}
      id={id}
      expanded={open}
      square={square}
      elevation={elevation}
      disableGutters={disableGutters}
      onChange={() => onChange?.(open ? false : true)}
      className={cls(
        className,
        `tdsk-accordion-${panel}-accordion`,
        openBottomBorder && `tdsk-accordion-bottom-border`
      )}
    >
      {(showHeader && (
        <AccordionSummary
          id={`${panel}-header`}
          aria-controls={`${panel}-content`}
          className={cls(`tdsk-accordion-${panel}-header`, open && `open`)}
          expandIcon={!Icon && expandIcon && <ExpandMoreIcon />}
        >
          {header || (
            <>
              <AccordionHeader
                className={cls(`tdsk-accordion-${panel}-header`, open && `open`)}
              >
                {Icon && (
                  <AccordionIconContainer
                    className={cls(`tdsk-accordion-${panel}-header-icon`, open && `open`)}
                  >
                    {isValidFuncComp(Icon) ? (
                      <Icon
                        {...iconProps}
                        sx={[inherit, iconProps?.sx]}
                      />
                    ) : (
                      Icon
                    )}
                  </AccordionIconContainer>
                )}

                {(title && (
                  <AccordionTitle
                    className={cls(
                      `tdsk-accordion-${panel}-header-title`,
                      open && `open`,
                      coloredTitle && `colored`
                    )}
                  >
                    {plainTitle ? title : isStr(title) ? capitalize(title) : title}
                  </AccordionTitle>
                )) ||
                  null}
              </AccordionHeader>

              {(actions?.length && (
                <AccordionActions
                  actions={actions}
                  show={alwaysShowActions || open}
                />
              )) ||
                null}
            </>
          )}
        </AccordionSummary>
      )) ||
        null}

      {children && (
        <AccordionDetails className={`tdsk-accordion-${panel}-details`}>
          {children}
        </AccordionDetails>
      )}
    </AccordionComp>
  )
}
