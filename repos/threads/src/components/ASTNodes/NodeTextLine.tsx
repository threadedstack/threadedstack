import type { TTextLine } from '@TTH/types/ast.types'
import { NodeSpan } from './NodeSpan'

export const NodeTextLine = ({ node }: { node: TTextLine }) => {
  return (
    <div
      style={{
        fontFamily: `monospace`,
        whiteSpace: `pre`,
        lineHeight: 1.4,
        display: `block`,
      }}
    >
      {node.children.map((span, i) => (
        <NodeSpan
          key={i}
          node={span}
        />
      ))}
    </div>
  )
}
