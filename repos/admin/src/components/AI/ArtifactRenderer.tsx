import type { TArtifactType } from '@tdsk/domain'

import { useState } from 'react'
import { MermaidRenderer } from '@TAF/components/AI/MermaidRenderer'
import { MarkdownRenderer } from '@TAF/components/AI/MarkdownRenderer'
import { Box, Chip, Paper, Drawer, Button, Typography, IconButton } from '@mui/material'
import {
  Close as CloseIcon,
  OpenInFull as ExpandIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'

export type TArtifactRendererProps = {
  content: string
  artifactType: TArtifactType
  title?: string
  language?: string
}

const monacoTypes: TArtifactType[] = [`code`, `json`, `yaml`, `xml`, `diff`]

export const ArtifactRenderer = (props: TArtifactRendererProps) => {
  const { content, artifactType, title, language } = props
  const [expanded, setExpanded] = useState(false)

  const onCopy = () => {
    navigator.clipboard.writeText(content)
  }

  const renderContent = () => {
    switch (artifactType) {
      case `markdown`:
        return <MarkdownRenderer content={content} />

      case `mermaid`:
        return <MermaidRenderer content={content} />

      case `html`:
      case `svg`:
        return (
          <Box
            sx={{ '& svg': { maxWidth: `100%`, height: `auto` } }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )

      case `image`:
        return (
          <Box
            component='img'
            src={
              content.startsWith(`data:`) ? content : `data:image/png;base64,${content}`
            }
            alt={title || `Image`}
            sx={{ maxWidth: `100%`, height: `auto`, borderRadius: 1 }}
          />
        )

      case `csv`: {
        const rows = content
          .split(`\n`)
          .filter(Boolean)
          .map((r) => r.split(`,`))
        const headers = rows[0] || []
        const body = rows.slice(1)
        return (
          <Box sx={{ overflowX: `auto` }}>
            <table style={{ borderCollapse: `collapse`, width: `100%`, fontSize: 13 }}>
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: `6px 12px`,
                        borderBottom: `2px solid rgba(255,255,255,0.2)`,
                        textAlign: `left`,
                      }}
                    >
                      {h.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: `4px 12px`,
                          borderBottom: `1px solid rgba(255,255,255,0.1)`,
                        }}
                      >
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )
      }

      case `table`: {
        try {
          const data = JSON.parse(content) as Record<string, unknown>[]
          if (!Array.isArray(data) || data.length === 0) throw new Error()
          const keys = Object.keys(data[0])
          return (
            <Box sx={{ overflowX: `auto` }}>
              <table style={{ borderCollapse: `collapse`, width: `100%`, fontSize: 13 }}>
                <thead>
                  <tr>
                    {keys.map((k) => (
                      <th
                        key={k}
                        style={{
                          padding: `6px 12px`,
                          borderBottom: `2px solid rgba(255,255,255,0.2)`,
                          textAlign: `left`,
                        }}
                      >
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, ri) => (
                    <tr key={ri}>
                      {keys.map((k) => (
                        <td
                          key={k}
                          style={{
                            padding: `4px 12px`,
                            borderBottom: `1px solid rgba(255,255,255,0.1)`,
                          }}
                        >
                          {String(row[k] ?? ``)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )
        } catch {
          return (
            <Typography
              sx={{ whiteSpace: `pre-wrap`, fontFamily: `monospace`, fontSize: 13 }}
            >
              {content}
            </Typography>
          )
        }
      }

      case `latex`:
        // LaTeX rendering requires react-katex -- fallback to monospace display
        return (
          <Typography
            sx={{ whiteSpace: `pre-wrap`, fontFamily: `monospace`, fontSize: 13, p: 1 }}
          >
            {content}
          </Typography>
        )

      case `code`:
      case `json`:
      case `yaml`:
      case `xml`:
      case `diff`:
        return (
          <Box
            component='pre'
            sx={{
              m: 0,
              p: 1.5,
              fontSize: 13,
              overflow: `auto`,
              fontFamily: `monospace`,
              borderRadius: 1,
              bgcolor: `rgba(0,0,0,0.2)`,
            }}
          >
            <code>{content}</code>
          </Box>
        )

      case `plaintext`:
      default:
        return (
          <Typography
            variant='body2'
            sx={{ whiteSpace: `pre-wrap`, wordBreak: `break-word`, fontSize: 13 }}
          >
            {content}
          </Typography>
        )
    }
  }

  return (
    <>
      <Paper
        variant='outlined'
        sx={{ mt: 1, overflow: `hidden` }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            display: `flex`,
            alignItems: `center`,
            gap: 0.5,
            borderBottom: 1,
            borderColor: `divider`,
            bgcolor: `action.hover`,
          }}
        >
          <Chip
            size='small'
            label={artifactType}
            variant='outlined'
            sx={{ fontSize: 11, height: 20 }}
          />
          {title && (
            <Typography
              variant='caption'
              sx={{ flex: 1 }}
              noWrap
            >
              {title}
            </Typography>
          )}
          {language && (
            <Chip
              size='small'
              label={language}
              variant='outlined'
              sx={{ fontSize: 11, height: 20 }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton
            size='small'
            onClick={onCopy}
            title='Copy'
          >
            <CopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size='small'
            onClick={() => setExpanded(true)}
            title='Expand'
          >
            <ExpandIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        <Box sx={{ p: 1.5, maxHeight: 300, overflow: `auto` }}>{renderContent()}</Box>
      </Paper>

      <Drawer
        anchor='right'
        open={expanded}
        onClose={() => setExpanded(false)}
        PaperProps={{ sx: { width: `60vw`, maxWidth: 900 } }}
      >
        <Box sx={{ p: 2, display: `flex`, alignItems: `center`, gap: 1 }}>
          <Typography
            variant='h6'
            sx={{ flex: 1 }}
          >
            {title || artifactType}
          </Typography>
          <Button
            size='small'
            startIcon={<CopyIcon />}
            onClick={onCopy}
          >
            Copy
          </Button>
          <IconButton onClick={() => setExpanded(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 2, overflow: `auto`, flex: 1 }}>{renderContent()}</Box>
      </Drawer>
    </>
  )
}
