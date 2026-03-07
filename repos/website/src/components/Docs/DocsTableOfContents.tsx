import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { useActiveHeading } from '@TAF/hooks/useActiveHeading'

type Heading = { id: string; text: string; level: number }

const DocsTableOfContents = () => {
  const [headings, setHeadings] = useState<Heading[]>([])
  const activeId = useActiveHeading()

  useEffect(() => {
    const elements = document.querySelectorAll('main h2[id], main h3[id]')
    const items: Heading[] = []
    for (const el of elements) {
      items.push({
        id: el.id,
        text: el.textContent || '',
        level: el.tagName === 'H2' ? 2 : 3,
      })
    }
    setHeadings(items)
  }, [])

  if (headings.length === 0) return null

  return (
    <Box
      sx={{
        width: 200,
        flexShrink: 0,
        position: 'sticky',
        top: 80,
        height: 'fit-content',
        display: { xs: 'none', lg: 'block' },
        py: 2,
        pr: 2,
      }}
    >
      <Typography
        variant='overline'
        sx={{ fontSize: 11, letterSpacing: 1.5, mb: 1, display: 'block', px: 1 }}
      >
        On this page
      </Typography>
      {headings.map((h) => (
        <Link
          key={h.id}
          href={`#${h.id}`}
          underline='none'
          sx={{
            display: 'block',
            py: 0.5,
            px: 1,
            pl: h.level === 3 ? 2.5 : 1,
            fontSize: 12,
            lineHeight: 1.5,
            color: activeId === h.id ? 'primary.main' : 'text.secondary',
            fontWeight: activeId === h.id ? 600 : 400,
            borderLeft: 2,
            borderColor: activeId === h.id ? 'primary.main' : 'transparent',
            '&:hover': { color: 'primary.main' },
          }}
        >
          {h.text}
        </Link>
      ))}
    </Box>
  )
}

export default DocsTableOfContents
