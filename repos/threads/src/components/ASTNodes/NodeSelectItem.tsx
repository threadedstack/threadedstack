import type { TSelectItem } from '@TTH/types/ast.types'
import ListItemButton from '@mui/material/ListItemButton'
import { NodeSpan } from './NodeSpan'
import { useInteraction } from '@TTH/contexts/InteractionContext'

export const NodeSelectItem = ({
  node,
  onSelect,
}: {
  node: TSelectItem
  onSelect?: () => void
}) => {
  const ctx = useInteraction()

  const handleClick = () => {
    if (onSelect) onSelect()
    else ctx?.sendKeystroke(`\n`)
  }

  return (
    <ListItemButton
      selected={node.selected}
      dense
      disableRipple
      onClick={handleClick}
      sx={{
        fontFamily: `monospace`,
        py: 0.25,
        px: 1,
        '&.Mui-selected': {
          bgcolor: `action.selected`,
        },
      }}
    >
      {node.children.map((span, i) => (
        <NodeSpan
          key={i}
          node={span}
        />
      ))}
    </ListItemButton>
  )
}
