import type { TSpan } from '@TTH/types/ast.types'

export const NodeSpan = ({ node }: { node: TSpan }) => {
  // fg/bg are already resolved (including INVERSE swap) by the tokenizer's resolveColors(),
  // so we always use them directly — no second swap needed here.
  const color = `rgb(${node.fg.r},${node.fg.g},${node.fg.b})`
  const backgroundColor = `rgb(${node.bg.r},${node.bg.g},${node.bg.b})`

  return (
    <span
      style={{
        color,
        backgroundColor,
        fontWeight: node.bold ? 700 : 400,
        fontStyle: node.italic ? `italic` : `normal`,
        textDecoration:
          [
            node.underline ? `underline` : null,
            node.strikethrough ? `line-through` : null,
          ]
            .filter(Boolean)
            .join(` `) || `none`,
        opacity: node.faint ? 0.5 : 1,
        fontFamily: `monospace`,
        whiteSpace: `pre`,
      }}
    >
      {node.text}
    </span>
  )
}
