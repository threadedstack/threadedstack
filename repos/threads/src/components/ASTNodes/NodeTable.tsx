import type { TTable } from '@TTH/types/ast.types'
import { NodeTableRow } from './NodeTableRow'

export const NodeTable = ({ node }: { node: TTable }) => {
  return (
    <table
      style={{
        fontFamily: `monospace`,
        borderCollapse: `collapse`,
        width: `100%`,
        marginBlock: `4px`,
      }}
    >
      <tbody>
        {node.children.map((row, i) => (
          <NodeTableRow
            key={i}
            node={row}
          />
        ))}
      </tbody>
    </table>
  )
}
