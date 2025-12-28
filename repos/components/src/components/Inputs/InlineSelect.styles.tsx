import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'
import { cmx } from '@TSC/theme/helpers'
import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import { grey, primary } from '@TSC/theme/colors'

export const InlineSelectContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== `height`,
})(({ theme, height }) => {
  const extra = height
    ? `
        overflow-y: auto;
        overflow-x: hidden;
        max-height: ${(height as number) * dims.form.inSelect.height}px;
      `
    : ``

  return `
    ${extra}
    display: flex;
    padding: ${gutter.px};
    flex-direction: column;
    margin-top: ${gutter.qpx};
    border-radius: ${dims.border.ipx};
    border: 1px solid ${theme.palette.border.default};
    background-color: ${theme.palette.background.muted};
  `
})

export const InlineSelectItem = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const bgcolor = isDark ? grey[700] : grey[400]

  return `
    &:first-of-type {
      margin-top: 0px !important;
    }

    opacity: 0.4;
    cursor: pointer;
    margin-top: ${gutter.hpx};
    padding: ${gutter.tpx} ${gutter.px};
    border-radius: ${dims.border.ipx};
    &:hover {
      opacity: 0.8 !important;
      background-color: ${cmx(bgcolor, 10)} !important;
      
    }
    
    &.selected {
      opacity: 1;
      background-color: ${cmx(primary.main, 10)};
    }

  `
})
