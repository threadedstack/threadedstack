import type {
  TDocument,
  TContentNode,
  TInteractionHandler,
  TSelectList,
  TSelectItem,
  TConfirm,
  TActionTarget,
  TLink,
} from '@TTH/ast'

const ARROW_UP = '\x1b[A'
const ARROW_DOWN = '\x1b[B'
const ENTER = '\n'

/**
 * Recursively walks Panel and Group children, collecting interaction handlers.
 */
function walkNode(
  node: TContentNode,
  sendKeystroke: (data: string) => void,
  handlers: TInteractionHandler[]
): void {
  switch (node.type) {
    case 'SelectList': {
      collectSelectListHandlers(node, sendKeystroke, handlers)
      break
    }
    case 'Confirm': {
      collectConfirmHandlers(node, sendKeystroke, handlers)
      break
    }
    case 'ActionTarget': {
      collectActionTargetHandlers(node, sendKeystroke, handlers)
      break
    }
    case 'Link': {
      collectLinkHandlers(node, handlers)
      break
    }
    case 'Panel':
    case 'Group': {
      for (const child of node.children) {
        walkNode(child, sendKeystroke, handlers)
      }
      break
    }
    default:
      break
  }
}

function collectSelectListHandlers(
  node: TSelectList,
  sendKeystroke: (data: string) => void,
  handlers: TInteractionHandler[]
): void {
  for (const item of node.children) {
    const label = item.children.map((s) => s.text).join('')
    if (node.style === 'numbered') {
      handlers.push({
        nodeType: 'SelectItem',
        bounds: item.bounds,
        label,
        execute: () => sendKeystroke(`${item.index + 1}${ENTER}`),
      })
    } else {
      // arrow or highlighted style — navigate with arrow keys from current selectedIndex then Enter
      handlers.push({
        nodeType: 'SelectItem',
        bounds: item.bounds,
        label,
        execute: () => {
          const diff = item.index - node.selectedIndex
          const key = diff >= 0 ? ARROW_DOWN : ARROW_UP
          const steps = Math.abs(diff)
          for (let i = 0; i < steps; i++) sendKeystroke(key)
          sendKeystroke(ENTER)
        },
      })
    }
  }
}

function collectConfirmHandlers(
  node: TConfirm,
  sendKeystroke: (data: string) => void,
  handlers: TInteractionHandler[]
): void {
  for (const option of node.options) {
    handlers.push({
      nodeType: 'Confirm',
      bounds: node.bounds,
      label: option,
      execute: () => sendKeystroke(option.toLowerCase().charAt(0)),
    })
  }
}

function collectActionTargetHandlers(
  node: TActionTarget,
  sendKeystroke: (data: string) => void,
  handlers: TInteractionHandler[]
): void {
  if (node.hotkey) {
    handlers.push({
      nodeType: 'ActionTarget',
      bounds: node.bounds,
      label: node.label,
      execute: () => sendKeystroke(node.hotkey as string),
    })
  } else {
    // Navigate to the target using arrow keys then Enter
    // Without knowing position context we emit a single Enter when already focused
    handlers.push({
      nodeType: 'ActionTarget',
      bounds: node.bounds,
      label: node.label,
      execute: () => {
        if (!node.focused) {
          sendKeystroke(ARROW_DOWN)
        }
        sendKeystroke(ENTER)
      },
    })
  }
}

function collectLinkHandlers(node: TLink, handlers: TInteractionHandler[]): void {
  if (node.url) {
    const url = node.url
    handlers.push({
      nodeType: 'Link',
      bounds: node.bounds,
      label: node.children.map((s) => s.text).join(''),
      execute: () => window.open(url, '_blank'),
    })
  }
}

/**
 * Walks the AST and creates keystroke handlers for interactive nodes.
 */
export function collectInteractions(
  doc: TDocument,
  sendKeystroke: (data: string) => void
): TInteractionHandler[] {
  const handlers: TInteractionHandler[] = []
  for (const child of doc.children) {
    walkNode(child, sendKeystroke, handlers)
  }
  return handlers
}
