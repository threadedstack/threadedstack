import type { TSelectItem } from '@TTH/ast'
import ListItemButton from '@mui/material/ListItemButton'
import { NodeSpan } from './NodeSpan'

export function NodeSelectItem({ node }: { node: TSelectItem }) {
  return (
    <ListItemButton
      selected={node.selected}
      dense
      disableRipple
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
