import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'

let mermaidLoaded = false
let mermaidPromise: Promise<typeof import('mermaid')> | null = null

const loadMermaid = async () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
  }
  const mermaid = await mermaidPromise
  if (!mermaidLoaded) {
    mermaid.default.initialize({
      startOnLoad: false,
      theme: `dark`,
      securityLevel: `strict`,
    })
    mermaidLoaded = true
  }
  return mermaid.default
}

export type TMermaidRendererProps = {
  content: string
}

export const MermaidRenderer = (props: TMermaidRendererProps) => {
  const { content } = props
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const mermaid = await loadMermaid()
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const { svg: rendered } = await mermaid.render(id, content)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Failed to render diagram`)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [content])

  if (error) {
    return (
      <Box>
        <Typography
          variant='caption'
          color='error'
        >
          Mermaid error: {error}
        </Typography>
        <Box
          component='pre'
          sx={{
            mt: 1,
            p: 1,
            fontSize: 12,
            fontFamily: `monospace`,
            bgcolor: `rgba(0,0,0,0.2)`,
            borderRadius: 1,
          }}
        >
          {content}
        </Box>
      </Box>
    )
  }

  if (!svg) {
    return (
      <Typography
        variant='body2'
        color='text.secondary'
      >
        Rendering diagram...
      </Typography>
    )
  }

  return (
    <Box
      sx={{ '& svg': { maxWidth: `100%`, height: `auto` } }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
