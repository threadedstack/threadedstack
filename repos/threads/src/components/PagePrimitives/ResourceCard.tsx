import type { ReactNode } from 'react'

import Box from '@mui/material/Box'

export type TResourceCard = {
  onClick?: () => void
  children: ReactNode
  className?: string
}

export const ResourceCard = (props: TResourceCard) => {
  const { onClick, children, className } = props

  return (
    <Box
      className={className}
      onClick={onClick}
      sx={{
        display: `flex`,
        flexDirection: `column`,
        gap: `10px`,
        bgcolor: `background.paper`,
        border: 1,
        borderColor: `divider`,
        borderRadius: `8px`,
        padding: `18px`,
        transition: `all 0.2s ease`,
        ...(onClick && { cursor: `pointer` }),
        '&:hover': {
          borderColor: `primary.main`,
          boxShadow: 2,
          transform: `translateY(-1px)`,
        },
      }}
    >
      {children}
    </Box>
  )
}
