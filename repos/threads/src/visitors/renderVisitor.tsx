import type { ReactElement } from 'react'
import type { TContentNode, TDocument } from '@TTH/ast'

import { NodePanel } from '@TTH/components/ASTNodes/NodePanel'
import { NodeGroup } from '@TTH/components/ASTNodes/NodeGroup'
import { NodeTextLine } from '@TTH/components/ASTNodes/NodeTextLine'
import { NodeSelectList } from '@TTH/components/ASTNodes/NodeSelectList'
import { NodeConfirm } from '@TTH/components/ASTNodes/NodeConfirm'
import { NodeTextInput } from '@TTH/components/ASTNodes/NodeTextInput'
import { NodeActionTarget } from '@TTH/components/ASTNodes/NodeActionTarget'
import { NodeStatusBar } from '@TTH/components/ASTNodes/NodeStatusBar'
import { NodeTable } from '@TTH/components/ASTNodes/NodeTable'
import { NodeDiffBlock } from '@TTH/components/ASTNodes/NodeDiffBlock'
import { NodeLink } from '@TTH/components/ASTNodes/NodeLink'
import { NodeSeparator } from '@TTH/components/ASTNodes/NodeSeparator'

export function renderNode(node: TContentNode, key: number | string): ReactElement {
  switch (node.type) {
    case `Panel`:
      return (
        <NodePanel
          key={key}
          node={node}
        />
      )
    case `Group`:
      return (
        <NodeGroup
          key={key}
          node={node}
        />
      )
    case `TextLine`:
      return (
        <NodeTextLine
          key={key}
          node={node}
        />
      )
    case `SelectList`:
      return (
        <NodeSelectList
          key={key}
          node={node}
        />
      )
    case `Confirm`:
      return (
        <NodeConfirm
          key={key}
          node={node}
        />
      )
    case `TextInput`:
      return (
        <NodeTextInput
          key={key}
          node={node}
        />
      )
    case `ActionTarget`:
      return (
        <NodeActionTarget
          key={key}
          node={node}
        />
      )
    case `StatusBar`:
      return (
        <NodeStatusBar
          key={key}
          node={node}
        />
      )
    case `Table`:
      return (
        <NodeTable
          key={key}
          node={node}
        />
      )
    case `DiffBlock`:
      return (
        <NodeDiffBlock
          key={key}
          node={node}
        />
      )
    case `Link`:
      return (
        <NodeLink
          key={key}
          node={node}
        />
      )
    case `Separator`:
      return (
        <NodeSeparator
          key={key}
          node={node}
        />
      )
    default: {
      const _exhaustive: never = node
      return (
        <span
          key={key}
          data-unknown={(_exhaustive as { type: string }).type}
        />
      )
    }
  }
}

export function renderDocument(doc: TDocument): ReactElement[] {
  return doc.children.map((child, i) => renderNode(child, i))
}
