import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

type TSectionHeader = {
  title: string
  overline?: string
  className?: string
  subtitle?: string
  align?: `left` | `center`
}

const SectionHeader = (props: TSectionHeader) => {
  const { title, subtitle, overline, className, align = 'center' } = props

  return (
    <Box
      className={className}
      sx={{
        textAlign: align,
        mb: { xs: 4, md: 6 },
        mx: align === 'center' ? 'auto' : undefined,
        maxWidth: align === 'center' ? 700 : undefined,
      }}
    >
      {overline && (
        <Typography
          color='primary'
          variant='overline'
          sx={{ letterSpacing: 2, fontWeight: 600, mb: 1, display: 'block' }}
        >
          {overline}
        </Typography>
      )}
      <Typography
        variant='h3'
        sx={{ mb: 1.5 }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          variant='body1'
          color='text.secondary'
          sx={{ maxWidth: 560, mx: align === 'center' ? 'auto' : undefined }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  )
}

export default SectionHeader
