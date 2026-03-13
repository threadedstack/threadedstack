import type { SxProps, Theme } from '@mui/material'
import type { ElementType, ForwardedRef, ComponentProps } from 'react'

import { forwardRef, useMemo } from 'react'
import Typography from '@mui/material/Typography'
import { CSSColorRefs } from '@TSC/constants/values'
import { useColor } from '@TSC/hooks/theme/useColor'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

export type TTextRef = ForwardedRef<typeof Typography>
type TTypography = ComponentProps<typeof Typography>

export type TText = Omit<TTypography, `color`> & {
  component?: ElementType
  textRef?: ForwardedRef<any>
  color?: string | TTypography[`color`]
}

export const Text = forwardRef((props: TText, ref: ForwardedRef<any>) => {
  const { component, color, sx, ...rest } = props
  const resolved = useColor(color)

  const { clr, style } = useMemo(() => {
    if (!resolved) return { style: sx, clr: undefined }
    if (!CSSColorRefs.some((ref) => resolved.startsWith(ref)))
      return { style: sx, clr: resolved }

    if (!sx) return { style: [{ color: resolved }], clr: undefined }

    return {
      clr: undefined,
      style: [...ensureArr(sx), { color: resolved }] as SxProps<Theme>,
    }
  }, [sx, resolved])

  return (
    <Typography
      {...rest}
      sx={style}
      ref={ref}
      color={clr}
      component={component}
    />
  )
})
