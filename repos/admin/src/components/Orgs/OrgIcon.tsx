import type { ComponentProps } from 'react'

import GridView from '@mui/icons-material/GridView'

export type TOrgIcon = ComponentProps<typeof GridView> & {
  text?: boolean
}

const style = {
  default: {
    color: `secondary.main`,
  },
  text: {
    mr: 1,
  },
}

export const OrgIcon = (props: TOrgIcon) => {
  const { text, sx, ...rest } = props

  return (
    <GridView
      {...rest}
      sx={[
        style.default,
        text ? style.text : undefined,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
