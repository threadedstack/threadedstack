import { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

type Props = {
  code: string
  language?: string
}

/**
 * Renders syntax-highlighted code using shiki.
 * Uses ref-based DOM manipulation to inject shiki's trusted HTML output.
 * shiki generates self-contained HTML from source code — no user input is involved.
 */
const CodeBlock = ({ code, language = 'typescript' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const highlight = async () => {
      const { codeToHtml } = await import('shiki')
      // shiki throws when `language` isn't a bundled grammar (e.g. an
      // authored placeholder like "tdsk-author-secret" in a docs fence) —
      // fall back to the always-bundled 'text' grammar so the block still
      // renders instead of silently staying empty.
      let html: string
      try {
        html = await codeToHtml(code, { lang: language, theme: 'github-dark' })
      } catch {
        html = await codeToHtml(code, { lang: 'text', theme: 'github-dark' })
      }
      // shiki produces sanitized HTML from raw code strings — safe to inject
      if (!cancelled && containerRef.current) {
        containerRef.current.textContent = ''
        const range = document.createRange()
        const fragment = range.createContextualFragment(html)
        containerRef.current.appendChild(fragment)
      }
    }
    highlight()
    return () => {
      cancelled = true
    }
  }, [code, language])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: '#141414',
        '& pre': {
          m: 0,
          p: 2.5,
          overflow: 'auto',
          fontSize: '0.875rem',
          lineHeight: 1.7,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
        },
        '& code': { fontFamily: 'inherit' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography
          variant='caption'
          sx={{
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            fontSize: 11,
          }}
        >
          {language}
        </Typography>
        <IconButton
          size='small'
          onClick={handleCopy}
          sx={{
            color: 'rgba(255,255,255,0.4)',
            '&:hover': { color: 'rgba(255,255,255,0.7)' },
          }}
        >
          {copied ? (
            <CheckIcon sx={{ fontSize: 16 }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>
      <Box ref={containerRef} />
    </Box>
  )
}

export default CodeBlock
