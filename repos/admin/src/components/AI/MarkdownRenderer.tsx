import remarkGfm from 'remark-gfm'
import { Box } from '@mui/material'
import ReactMarkdown from 'react-markdown'

export type TMarkdownRendererProps = {
  content: string
}

export const MarkdownRenderer = (props: TMarkdownRendererProps) => {
  const { content } = props

  return (
    <Box
      className='tdsk-markdown-renderer'
      sx={{
        '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 1 },
        '& p': { my: 0.5 },
        '& ul, & ol': { pl: 3 },
        '& pre': {
          p: 1.5,
          my: 1,
          borderRadius: 1,
          overflow: `auto`,
          bgcolor: `rgba(0,0,0,0.2)`,
          fontFamily: `monospace`,
          fontSize: 13,
        },
        '& code': {
          fontFamily: `monospace`,
          fontSize: 13,
          bgcolor: `rgba(0,0,0,0.15)`,
          px: 0.5,
          borderRadius: 0.5,
        },
        '& pre code': {
          bgcolor: `transparent`,
          px: 0,
        },
        '& table': {
          borderCollapse: `collapse`,
          width: `100%`,
          my: 1,
        },
        '& th, & td': {
          border: `1px solid`,
          borderColor: `divider`,
          px: 1.5,
          py: 0.5,
          textAlign: `left`,
        },
        '& th': {
          bgcolor: `action.hover`,
          fontWeight: `bold`,
        },
        '& blockquote': {
          borderLeft: 3,
          borderColor: `primary.main`,
          pl: 2,
          ml: 0,
          my: 1,
          color: `text.secondary`,
        },
        '& a': {
          color: `primary.main`,
          textDecoration: `none`,
          '&:hover': { textDecoration: `underline` },
        },
        '& img': {
          maxWidth: `100%`,
          height: `auto`,
        },
        '& hr': {
          border: `none`,
          borderTop: `1px solid`,
          borderColor: `divider`,
          my: 2,
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  )
}
