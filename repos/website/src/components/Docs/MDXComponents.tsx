import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import CalloutBox from '@TAF/components/Shared/CalloutBox'

export const mdxComponents = {
  h1: (props: any) => (
    <Typography
      variant='h3'
      sx={{ mb: 3, mt: 4 }}
      {...props}
    />
  ),
  h2: (props: any) => (
    <Typography
      variant='h4'
      sx={{ mb: 2, mt: 4 }}
      {...props}
    />
  ),
  h3: (props: any) => (
    <Typography
      variant='h5'
      sx={{ mb: 1.5, mt: 3 }}
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
        borderLeft: 3,
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
        pl: 2,
        py: 1,
        my: 2,
        borderRadius: 1,
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
            bgcolor: 'action.hover',
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: '0.875em',
          }}
        >
          {children}
        </Box>
      )
    return (
      <CodeBlock
        code={String(children).trim()}
        language={language}
      />
    )
  },
  Note: ({ children }: any) => <CalloutBox severity='info'>{children}</CalloutBox>,
  Warning: ({ children }: any) => <CalloutBox severity='warning'>{children}</CalloutBox>,
  Tip: ({ children }: any) => <CalloutBox severity='success'>{children}</CalloutBox>,
}
