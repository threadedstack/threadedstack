import type { ReactNode } from 'react'

import { Stack } from '@mui/material'
import { Text } from '@tdsk/components'

export type TFormSectionProps = {
  title: string
  spacing?: number
  children: ReactNode
}

export const FormSection = ({ title, children, spacing = 2 }: TFormSectionProps) => (
  <div>
    <Text
      variant='subtitle2'
      sx={{ fontWeight: 600, mb: 2 }}
    >
      {title}
    </Text>
    <Stack spacing={spacing}>{children}</Stack>
  </div>
)
