import type { IInput } from '@TSC/types'

import { grey, gutter } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils/cls'
import styled from '@mui/material/styles/styled'
import { InputStateHandler } from './InputStateHandler'
import Slider, { SliderProps as MSliderProps } from '@mui/material/Slider'

type SliderInputProps = IInput &
  MSliderProps & {
    setField?(field: string, value: number, shouldValidate?: boolean): void
  }

const SliderInput = (props: SliderInputProps) => {
  const {
    id,
    label,
    hidden,
    ignore,
    depends,
    tooltip,
    setField,
    hasError,
    disabled,
    required,
    className,
    helperText,
    description = helperText,
    ...sliderProps
  } = props

  const onChange = (event: any) => {
    const parsedValue = Number.parseFloat(event.target.value)
    const { min, max, onChange } = sliderProps

    if (max && parsedValue > max) setField && setField(id, max)
    else if (min && parsedValue < min) setField && setField(id, min)
    else onChange && onChange(event, parsedValue, 0)
  }

  return (
    <InputStateHandler
      id={id}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      disabled={disabled}
      hasError={hasError}
      required={required}
      description={description}
      notificationsProps={{
        count: sliderProps.value?.toString() || '0',
        inputProps: {
          id,
          max: sliderProps.max,
          min: sliderProps.min,
          step: sliderProps.step || 1,
          onChange,
        },
      }}
    >
      <StyledSlider
        {...sliderProps}
        id={id}
        name={id}
        disabled={disabled}
        className={cls(
          className,
          hidden && `hidden`,
          hasError && `error`,
          disabled && `disabled`,
          required && `required`
        )}
      />
    </InputStateHandler>
  )
}

const StyledSlider = styled(Slider)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`

  return {
    padding: `${gutter.hpx} 0px`,
    width: `calc(100% - 18px)`,
    marginLeft: `8px`,
    color: theme.palette.border.default,
    height: 3,
    [`& .MuiSlider-track`]: {
      border: `none`,
      color: grey[500],
    },
    [`& .MuiSlider-thumb`]: {
      height: 15,
      width: 15,
      backgroundColor: isDark ? `white` : grey[600],
      border: `4px solid ${theme.palette.border.default}`,
      [`&:focus, &:hover, &.Mui-active, &.Mui-focusVisible`]: {
        boxShadow: `inherit`,
      },
      [`&:before`]: {
        display: `none`,
      },
    },
    [`& .MuiSlider-valueLabel`]: {
      lineHeight: 1.2,
      fontSize: 12,
      background: `unset`,
      padding: 0,
      width: 32,
      height: 32,
      borderRadius: `50% 50% 50% 0`,
      backgroundColor: `#52af77`,
      transformOrigin: `bottom left`,
      transform: `translate(50%, -100%) rotate(-45deg) scale(0)`,
      [`&:before`]: { display: `none` },
      [`&.MuiSlider-valueLabelOpen`]: {
        transform: `translate(50%, -100%) rotate(-45deg) scale(1)`,
      },
      [`& > *`]: {
        transform: `rotate(45deg)`,
      },
    },
  }
})

export { SliderInput }
export type { SliderInputProps }
