import type { TContentNode, TSelectItem, TAriaProps } from '@TTH/types/ast.types'

/**
 * Maps an AST content node to ARIA attributes for accessibility.
 * Also accepts TSelectItem for completeness (not part of TContentNode union).
 */
export function getAriaProps(node: TContentNode | TSelectItem): TAriaProps {
  switch (node.type) {
    case `SelectList`:
      return {
        role: `listbox`,
        'aria-activedescendant': `select-item-${node.selectedIndex}`,
      }
    case `SelectItem`:
      return {
        role: `option`,
        'aria-selected': node.selected,
        id: `select-item-${node.index}`,
      }
    case `TextInput`:
      return {
        role: `textbox`,
        'aria-label': node.prompt,
      }
    case `ActionTarget`:
      return {
        role: `button`,
        'aria-label': node.label,
      }
    case `Table`:
      return {
        role: `table`,
      }
    case `StatusBar`:
      return {
        role: `status`,
        'aria-live': `polite`,
      }
    case `Confirm`:
      return {
        role: `alertdialog`,
        'aria-label': node.question,
      }
    default:
      return {}
  }
}
