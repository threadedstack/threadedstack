import { ComponentRegistry, AllowedHtmlElements } from '@tdsk/domain'
import type { TJsonComponentNode } from '@tdsk/domain'

const MaxDepth = 10

const registrySet = new Set<string>(ComponentRegistry)
const htmlSet = new Set<string>(AllowedHtmlElements)

export function validateTree(tree: unknown): tree is TJsonComponentNode {
  if (!isNode(tree)) return false
  if (tree.type !== 'div') return false
  return validateNode(tree, 0)
}

function isNode(val: unknown): val is TJsonComponentNode {
  return (
    typeof val === 'object' &&
    val !== null &&
    'type' in val &&
    typeof (val as Record<string, unknown>).type === 'string'
  )
}

function validateNode(node: TJsonComponentNode, depth: number): boolean {
  if (depth > MaxDepth) return false

  const { type, props, children } = node

  if (!registrySet.has(type) && !htmlSet.has(type)) return false

  if (registrySet.has(type) && !validateComponentProps(type, props)) return false

  if (children) {
    if (!Array.isArray(children)) return false
    for (const child of children) {
      if (typeof child === 'string') continue
      if (!isNode(child)) return false
      if (!validateNode(child, depth + 1)) return false
    }
  }

  return true
}

function validateComponentProps(type: string, props: unknown): boolean {
  if (!props || typeof props !== 'object') return false
  const p = props as Record<string, unknown>

  switch (type) {
    case 'Select': {
      const options = p.options
      if (!Array.isArray(options) || options.length < 2) return false
      return true
    }
    case 'Confirm': {
      if (typeof p.prompt !== 'string' || !p.prompt.trim()) return false
      return true
    }
    case 'TextInput':
    case 'Alert':
    case 'ProgressBar':
      return true
    default:
      return false
  }
}
