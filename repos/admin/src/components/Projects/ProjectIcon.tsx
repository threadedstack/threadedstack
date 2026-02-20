import type { ComponentProps } from 'react'

import WorkspacesIcon from '@mui/icons-material/Workspaces'

export type TProjectIcon = ComponentProps<typeof WorkspacesIcon> & {
  text?: boolean
}

const style = {
  default: {
    color: `primary.main`,
  },
  text: {
    mr: 1,
  },
}

export const ProjectIcon = (props: TProjectIcon) => {
  const { text, sx, ...rest } = props

  return (
    <WorkspacesIcon
      {...rest}
      sx={[
        style.default,
        text ? style.text : undefined,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
