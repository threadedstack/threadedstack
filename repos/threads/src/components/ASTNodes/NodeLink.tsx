import type { TLink } from '@TTH/ast'
import MuiLink from '@mui/material/Link'
import { NodeSpan } from './NodeSpan'

export function NodeLink({ node }: { node: TLink }) {
  return (
    <MuiLink
      href={node.url}
      target='_blank'
      rel='noopener noreferrer'
      sx={{
        fontFamily: `monospace`,
        color: `primary.light`,
        textDecorationColor: `primary.light`,
        display: `inline`,
      }}
    >
      {node.children.map((span, i) => (
        <NodeSpan
          key={i}
          node={span}
        />
      ))}
    </MuiLink>
  )
}
