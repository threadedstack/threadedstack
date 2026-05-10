import type { TextareaAutosizeProps } from '@mui/material/TextareaAutosize'
import type { InputLabelProps } from '@mui/material/InputLabel'

import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'
import Stack from '@mui/material/Stack'
import { grey, primary } from '@TSC/theme/colors'
import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import { MuiChipsInput } from 'mui-chips-input'
import TextField from '@mui/material/TextField'
import MInputLabel from '@mui/material/InputLabel'
import MOutlinedInput from '@mui/material/OutlinedInput'
import TextareaAutosize from '@mui/material/TextareaAutosize'
import { Label as OptLabel, Text } from '@TSC/components/Text'

type TTextarea = (props: TextareaAutosizeProps) => ReturnType<typeof TextareaAutosize>

export const InputStateStack = styled(Stack)(({ theme }) => {
  return `

    &.full-width {
      width: 100%;
    }

    &.disabled {
      label:not(.no-label-dim),
      .MuiSlider-root,
      .MuiInputBase-root,
      .MuiSwitch-root {
        opacity: 0.5;
      }
    }

    & .MuiAutocomplete-inputRoot {
      height: ${dims.form.input.hpx};
      padding: 0px;
      
      & input.MuiInputBase-input {
        padding-left: ${gutter.px};
      }
    }
    
    & .MuiInputAdornment-root {
      margin-right: 0px;
    }
    
    & .MuiInputBase-input {
      padding-left: ${gutter.px};
    }

    & .MuiInputBase-root.MuiInputBase-adornedStart {
      padding-left: 0px;

      & .MuiInputBase-input {
        padding-left: ${gutter.cpx};
      }
    }
    

    & .MuiFormHelperText-root {
      padding-left: ${gutter.hpx};
      padding-top: ${gutter.qpx};
    }
  `
})

export const Label = styled(MInputLabel)<InputLabelProps>(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? grey[300] : grey[500]

  return `
    color: ${color};
    font-size: 12px;
    font-weight: 600;
  `
})

export const TextareaContainer = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100%;
    display: flex;
    margin-top: ${gutter.qpx};
    border-radius: ${dims.border.ipx};
    transition: border-color 0.15s ease;
    border: 1px solid ${theme.palette.border.default};

    &:hover {
      border-color: ${theme.palette.border.altMuted};
    }

    &:focus-within {
      border: 1px solid ${theme.palette.primary.main};
    }

    &:focus-visible {
      outline: 0;
    }
  `
})

export const InputText = styled(TextField)(({ theme }) => {
  return `
    background: ${theme.palette.background.input};
    color: ${theme.palette.colors.primaryForeground};

    & input::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }

    & textarea::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }

    & fieldset {
      border: 1px solid ${theme.palette.border.default};
    }

  `
})

export const OutlinedInput = styled(MOutlinedInput)(({ theme }) => {
  return `
    height: ${dims.form.input.hpx};
    background: ${theme.palette.background.input};
    color: ${theme.palette.colors.primaryForeground};

    & input::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }

    & textarea::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }

    & fieldset {
      border: 1px solid ${theme.palette.border.default};
    }
  `
})

export const Textarea = styled((props) => (
  <TextareaContainer>
    <TextareaAutosize {...props} />
  </TextareaContainer>
))(({ theme }) => {
  return `
    width: 100%;
    font: inherit;
    color: currentColor;
    box-shadow: none;
    box-sizing: border-box;
    letter-spacing: inherit;
    border-radius: ${dims.border.ipx};
    padding: ${gutter.tpx} ${gutter.px};
    background: ${theme.palette.background.input};
    color: ${theme.palette.colors.primaryForeground};

    border: 1px solid transparent;

    &:hover {
      border: 1px solid transparent;
    }

    &:focus {
      border: 1px solid ${theme.palette.primary.main};
    }

    &:focus-visible {
      outline: 0;
    }
    
    &::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }
  `
}) as TTextarea

export const Tags = styled(MuiChipsInput)(({ theme }) => {
  return `
    background: ${theme.palette.background.muted};
    color: ${theme.palette.colors.primaryForeground};
    
    &.one-tag-per-line .MuiInputBase-root {
      flex-direction: column;
    }

    .MuiInputBase-root {
      input {
          width: 100%;
      }
    }
    
    & input::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }

    & textarea::placeholder {
      opacity: 1;
      font-size: 14px;
      color: ${theme.palette.colors.placeholder};
    }
  `
})

export const AutoOptionItem = styled('li')(({ theme }) => {
  const isDark = theme.palette.mode === `dark`

  return `
    display: flex;
    width: 100%;
    font-size: 14px;
    font-weight: 500;
    align-items: start;
    flex-direction: column;
    justify-content: center;
    padding: ${gutter.hpx} ${gutter.px};
    border-radius: 4px;
    margin: ${gutter.qpx} ${gutter.hpx};
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    color: ${isDark ? grey[300] : grey[700]};

    &:hover {
      color: ${isDark ? grey[100] : primary.main};
      background-color: ${isDark ? grey[850] : primary[50]};
    }

    &[aria-selected="true"] {
      color: ${isDark ? grey[100] : primary[500]};
      background-color: ${isDark ? grey[800] : primary[50]};

      &:hover {
        background-color: ${isDark ? grey[825] : primary[100]};
      }
    }
  `
})

export const OptionLabel = styled(OptLabel)(({ theme }) => {
  return `
    font-size: 14px;

    &.bold {
      font-weight: bold;
    }
  `
})

export const OptionDesc = styled(Text)(({ theme }) => {
  return `
    font-size: 12px;
  `
})
