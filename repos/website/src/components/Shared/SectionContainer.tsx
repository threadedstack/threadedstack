import type { SxProps, Theme } from '@mui/material'

import Box from '@mui/material/Box'
import Container from '@mui/material/Container'

type TSectionContainer = {
  id?: string
  className?: string
  sx?: SxProps<Theme>
  children: React.ReactNode
  maxWidth?: `sm` | `md` | `lg` | `xl`
}

const SectionContainer = (props: TSectionContainer) => {
  const { className, children, sx, maxWidth = 'lg', id } = props
  return (
    <Box
      className={className}
      component='section'
      id={id}
      sx={{ py: { xs: 6, md: 10 }, ...sx }}
    >
      <Container maxWidth={maxWidth}>{children}</Container>
    </Box>
  )
}

export default SectionContainer
