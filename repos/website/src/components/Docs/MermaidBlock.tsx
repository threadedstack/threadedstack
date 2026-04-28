import Box from '@mui/material/Box'
import { useAtomValue } from 'jotai'
import { themeTypeAtom } from '@TAF/state/theme'
import { useEffect, useRef, useId, useState } from 'react'

type Props = {
  code: string
}

/**
 * Renders mermaid diagram syntax into SVG at runtime.
 * Dynamically imports mermaid to avoid bundling it eagerly.
 * Re-renders when the code or theme changes.
 */
const MermaidBlock = ({ code }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const themeType = useAtomValue(themeTypeAtom)
  const reactId = useId()
  const mermaidId = `mermaid-${reactId.replace(/:/g, '')}`
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: themeType === `dark` ? `dark` : `default`,
          fontFamily: `'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace`,
        })

        const { svg } = await mermaid.render(mermaidId, code)

        if (!cancelled && containerRef.current) {
          containerRef.current.textContent = ``
          const range = document.createRange()
          const fragment = range.createContextualFragment(svg)
          containerRef.current.appendChild(fragment)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code, themeType, mermaidId])

  if (error) {
    return (
      <Box
        sx={{
          p: 2,
          overflow: 'auto',
          borderRadius: '12px',
          fontSize: '0.875rem',
          bgcolor: 'error.main',
          whiteSpace: 'pre-wrap',
          color: 'error.contrastText',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
        }}
      >
        {error}
      </Box>
    )
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        '& svg': {
          height: 'auto',
          maxWidth: '100%',
        },
      }}
    />
  )
}

export default MermaidBlock
