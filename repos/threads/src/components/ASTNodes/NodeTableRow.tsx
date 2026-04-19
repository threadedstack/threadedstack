import type { TTableRow } from '@TTH/ast'
import { NodeSpan } from './NodeSpan'

export function NodeTableRow({ node }: { node: TTableRow }) {
  return (
    <tr>
      {node.cells.map((cell, i) => {
        const Tag = node.isHeader ? `th` : `td`
        return (
          <Tag
            key={i}
            style={{
              fontFamily: `monospace`,
              fontWeight: node.isHeader ? 700 : 400,
              padding: `2px 8px`,
              textAlign: `left`,
              whiteSpace: `pre`,
              borderBottom: `1px solid rgba(128,128,128,0.2)`,
            }}
          >
            {cell.map((span, j) => (
              <NodeSpan
                key={j}
                node={span}
              />
            ))}
          </Tag>
        )
      })}
    </tr>
  )
}
