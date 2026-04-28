import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import { lazy, Suspense } from 'react'
import Table from '@mui/material/Table'
import Divider from '@mui/material/Divider'
import TableRow from '@mui/material/TableRow'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import Typography from '@mui/material/Typography'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import CalloutBox from '@TAF/components/Shared/CalloutBox'

const MermaidBlock = lazy(() => import('@TAF/components/Docs/MermaidBlock'))

export const mdxComponents = {
  h1: (props: any) => (
    <Typography
      variant='h3'
      sx={{ mb: 3, mt: 4, color: 'text.primary' }}
      {...props}
    />
  ),
  h2: (props: any) => (
    <Typography
      variant='h4'
      sx={{ mb: 2, mt: 4, color: 'text.primary' }}
      {...props}
    />
  ),
  h3: (props: any) => (
    <Typography
      variant='h5'
      sx={{ mb: 1.5, mt: 3, color: 'text.primary' }}
      {...props}
    />
  ),
  p: (props: any) => (
    <Typography
      variant='body1'
      sx={{ mb: 2, lineHeight: 1.8 }}
      {...props}
    />
  ),
  a: (props: any) => (
    <Link
      color='primary'
      {...props}
    />
  ),
  hr: () => <Divider sx={{ my: 3 }} />,
  blockquote: (props: any) => (
    <Box
      sx={{
        pl: 2,
        py: 1,
        my: 2,
        borderLeft: 3,
        borderRadius: 1,
        bgcolor: 'action.hover',
        borderColor: 'primary.main',
      }}
      {...props}
    />
  ),
  table: (props: any) => (
    <Table
      size='small'
      sx={{ my: 2 }}
      {...props}
    />
  ),
  thead: (props: any) => <TableHead {...props} />,
  tbody: (props: any) => <TableBody {...props} />,
  tr: (props: any) => <TableRow {...props} />,
  th: (props: any) => (
    <TableCell
      sx={{ fontWeight: 600 }}
      {...props}
    />
  ),
  td: (props: any) => <TableCell {...props} />,
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children }: any) => {
    const language = className?.replace('language-', '') || 'text'
    if (!className)
      return (
        <Box
          component='code'
          sx={{
            px: 0.75,
            py: 0.25,
            border: 1,
            borderRadius: 0.5,
            fontSize: '0.875em',
            borderColor: 'divider',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
          }}
        >
          {children}
        </Box>
      )
    if (language === 'mermaid')
      return (
        <Suspense fallback={null}>
          <MermaidBlock code={String(children).trim()} />
        </Suspense>
      )
    return (
      <CodeBlock
        language={language}
        code={String(children).trim()}
      />
    )
  },
  Note: ({ children }: any) => <CalloutBox severity='info'>{children}</CalloutBox>,
  Tip: ({ children }: any) => <CalloutBox severity='success'>{children}</CalloutBox>,
  Warning: ({ children }: any) => <CalloutBox severity='warning'>{children}</CalloutBox>,
}
