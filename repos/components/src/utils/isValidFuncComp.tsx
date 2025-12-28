import type { ComponentType, ElementType, ReactElement } from 'react'

import { isFunc, isObj } from '@keg-hub/jsutils'
import { isValidElement } from 'react'

/**
 * Validates if the passed in Component is a render-able react function or class component
 */
export const isValidFuncComp = (Component: any): Component is ElementType<any> => {
  return isMemoComp(Component) && `type` in Component
    ? isValidFuncComp(Component.type)
    : (!isValidElement<any>(Component) && isFunc<ComponentType<any>>(Component)) ||
        (isObj(Component) &&
          `render` in Component &&
          `$$typeof` in Component &&
          !(`type` in Component))
}

export const isReactElement = (Component: any): Component is ReactElement => {
  return (
    isForwardRefComp(Component) ||
    isMemoComp(Component) ||
    (isObj(Component) &&
      `type` in Component &&
      `render` in Component.type &&
      `$$typeof` in Component.type)
  )
}

/**
 * Validates if the passed in Component is wrapped in React.forwardRef
 */
export const isForwardRefComp = (Component: any): Component is ReactElement => {
  const type = Component?.$$typeof?.toString?.()
  return type === `Symbol(react.element)` || type === `Symbol(react.forward_ref)`
}

/**
 * Validates if the passed in Component is wrapped in React.forwardRef
 */
export const isMemoComp = (Component: any): Component is ReactElement => {
  return Component?.$$typeof?.toString?.() === `Symbol(react.memo)`
}

/**
 * Validates if the passed in Component is a render-able react function or class component
 */
export const isFuncElement = <T = any>(Component: any): Component is ElementType<T> => {
  return (
    typeof Component === `function` &&
    (String(Component).includes(`return React.createElement`) ||
      !!Component.prototype.isReactComponent)
  )
}
