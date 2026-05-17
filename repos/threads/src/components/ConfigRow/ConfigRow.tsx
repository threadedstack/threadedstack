import { styled } from '@mui/material/styles'
import { Box, Typography } from '@mui/material'
import { MonoFont } from '@TTH/constants/values'

export type TConfigRow = {
  label: string
  icon?: React.ReactNode
  value: React.ReactNode
}

export const ConfigLabel = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: `0.05em`,
  color: theme.palette.text.secondary,
  textTransform: `uppercase` as const,
}))

export const ConfigValue = styled(Typography)({
  fontSize: 14,
  fontFamily: MonoFont,
})

export const ConfigRow = (props: TConfigRow) => {
  const { icon, label, value } = props

  return (
    <Box
      sx={{
        py: 0.75,
        display: `flex`,
        alignItems: `center`,
        ...(icon ? { gap: 1.5 } : { justifyContent: `space-between` }),
      }}
    >
      {icon && (
        <Box sx={{ display: `flex`, color: `text.secondary`, flexShrink: 0 }}>{icon}</Box>
      )}
      <ConfigLabel sx={icon ? { minWidth: 100 } : undefined}>{label}</ConfigLabel>
      {icon ? (
        <Box sx={{ flex: 1, display: `flex`, justifyContent: `flex-end` }}>
          {typeof value === `string` || typeof value === `number` ? (
            <ConfigValue>{value}</ConfigValue>
          ) : (
            value
          )}
        </Box>
      ) : typeof value === `string` || typeof value === `number` ? (
        <ConfigValue>{value}</ConfigValue>
      ) : (
        value
      )}
    </Box>
  )
}
