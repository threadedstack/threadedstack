import type { TAccordionAction } from '@TSC/types'

import { AccordionAction } from '@TSC/components/Accordion/AccordionAction'
import { AccordionActionsContainer } from '@TSC/components/Accordion/AccordionActions.styles'
import { cls } from '@keg-hub/jsutils/cls'

export type TAccordionActions = {
  show?: boolean
  actions?: TAccordionAction[]
}

export const AccordionActions = (props: TAccordionActions) => {
  const { show, actions } = props

  return (
    <AccordionActionsContainer
      className={cls(`tdsk-accordion-section-actions-container`, show && `show`)}
    >
      {actions.map((action) => {
        return (
          <AccordionAction
            {...action}
            key={(action?.key || action?.id || action?.name || action?.text) as string}
          />
        )
      })}
    </AccordionActionsContainer>
  )
}
