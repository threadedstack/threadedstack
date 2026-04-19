import type { TSelectList } from '@TTH/ast'
import List from '@mui/material/List'
import { NodeSelectItem } from './NodeSelectItem'

export function NodeSelectList({ node }: { node: TSelectList }) {
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
        />
      ))}
    </List>
  )
}
