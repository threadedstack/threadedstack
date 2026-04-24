import type { TJsonComponentNode, TJsonComponentTree, TInteraction } from '@tdsk/domain'

import React from 'react'
import { Box } from '@mui/material'
import { GuiComponentRegistry } from './registry'
import { AllowedHtmlElements } from '@tdsk/domain'

const AllowedHtmlSet = new Set<string>(AllowedHtmlElements)

type TRendererProps = {
  tree: TJsonComponentTree
  onAction: (interaction: TInteraction) => void
}

export function GenerativeUIRenderer({ tree, onAction }: TRendererProps) {
  return (
    <Box
      className={`fade-swap`}
      sx={{ fontSize: 14, lineHeight: 1.6 }}
    >
      {renderNode(tree, onAction, `root`)}
    </Box>
  )
}

function renderNode(
  node: TJsonComponentNode | string,
  onAction: (interaction: TInteraction) => void,
  key: string
): React.ReactNode {
  if (typeof node === `string`) return node
  if (!node || typeof node !== `object` || !node.type) return null

  const RegistryComponent = GuiComponentRegistry[node.type]

  if (RegistryComponent) {
    return (
      <RegistryComponent
        key={key}
        {...(node.props ?? {})}
        onAction={onAction}
      >
        {renderChildren(node.children, onAction, key)}
      </RegistryComponent>
    )
  }

  if (!AllowedHtmlSet.has(node.type)) return null

  const children = renderChildren(node.children, onAction, key)
  return React.createElement(node.type, { key }, ...children)
}

function renderChildren(
  children: (TJsonComponentNode | string)[] | undefined,
  onAction: (interaction: TInteraction) => void,
  parentKey: string
): React.ReactNode[] {
  if (!children) return []
  return children.map((child, i) => renderNode(child, onAction, `${parentKey}-${i}`))
}
