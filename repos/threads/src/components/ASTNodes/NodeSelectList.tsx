import type { TSelectList } from '@TTH/types/ast.types'

import { useCallback } from 'react'
import List from '@mui/material/List'
import { NodeSelectItem } from './NodeSelectItem'
import { useInteraction } from '@TTH/contexts/InteractionContext'

const ARROW_UP = `\x1b[A`
const ARROW_DOWN = `\x1b[B`
const ENTER = `\n`

export const NodeSelectList = ({ node }: { node: TSelectList }) => {
  const ctx = useInteraction()

  const handleSelect = useCallback(
    (itemIndex: number) => {
      if (!ctx) return
      if (node.style === `numbered`) {
        ctx.sendKeystroke(`${itemIndex + 1}${ENTER}`)
      } else {
        const diff = itemIndex - node.selectedIndex
        const key = diff >= 0 ? ARROW_DOWN : ARROW_UP
        const steps = Math.abs(diff)
        for (let i = 0; i < steps; i++) ctx.sendKeystroke(key)
        ctx.sendKeystroke(ENTER)
      }
    },
    [ctx, node.style, node.selectedIndex]
  )

  return (
    <List
      dense
      disablePadding
      sx={{ fontFamily: `monospace`, my: 0.5 }}
    >
      {node.children.map((item, i) => (
        <NodeSelectItem
          key={i}
          node={item}
          onSelect={() => handleSelect(item.index)}
        />
      ))}
    </List>
  )
}
