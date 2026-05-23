import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

import { dims } from '@TSC/theme/dims'
import { grey } from '@TSC/theme/colors'
import { gutter } from '@TSC/theme/gutter'

export const MonacoContainer = styled(Box)(({ theme }) => {
  return `
    position: relative;
    background-color: transparent;
    min-height: ${dims.form.input.hpx};
    border-radius: ${dims.border.ipx};


    &.disabled > section {
      cursor: not-allowed;
    }

    & > section {
      padding-top: ${gutter.hpx};
      padding-bottom: ${gutter.hpx};
      background-color: transparent;
    }

    &.disabled .tdsk-editor {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    &.no-editor-line-num .tdsk-editor .monaco-editor > .overflow-guard {
      & > .margin {
        width: 0px !important;
      }

      & .lines-content.monaco-editor-background {
        margin-left: ${gutter.qpx};
      }
    }

    & .tdsk-editor {
      min-height: ${dims.form.input.hpx};
      border-radius: ${dims.border.ipx};
      border: 1px solid ${theme.palette.border.default};
      transition: border-color 0.15s ease;
      
      & .monaco-editor {
        outline: none;
        border-radius: ${dims.border.ipx};
        min-height: ${dims.form.input.hpx};

        & > .overflow-guard {
          border-radius: ${dims.border.ipx};
          min-height: ${dims.form.input.hpx};
          & > .margin {
            min-height: ${dims.form.input.hpx};
          }

          & .lines-content.monaco-editor-background {
            margin-left: ${gutter.px};
          }
        }
      }

      &:hover {
        border-color: ${theme.palette.border.altMuted};
      }

      &:focus-within {
        border: 1px solid ${theme.palette.primary.main};
        outline: 1px solid ${theme.palette.primary.main};
      }

      &:focus-visible {
        outline: 0;
      }
      
    }


    &.tdsk-monaco-ide {
      height: 100%;
      min-height: 0;
      border-radius: 0;

      & > section {
        padding: 0;
      }

      & .tdsk-editor {
        height: 100%;
        min-height: 0;
        border: none;
        border-radius: 0;

        &:hover { border-color: transparent; }
        &:focus-within { border: none; outline: none; }

        & .monaco-editor {
          min-height: 0;
          border-radius: 0;
          & > .overflow-guard {
            min-height: 0;
            border-radius: 0;
            & > .margin { min-height: 0; }
          }
        }
      }
    }
  `
})

export const MonacoActionsContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
    position: relative;
    align-items: center;
    padding: 0px ${gutter.px};
    margin-top: ${gutter.mpx};
    justify-content: space-between;
    min-height: ${dims.section.header.hpx};

    & .tdsk-thread-section-actions-container {
      align-items: center;
      justify-content: end;

      & .tdsk-thread-action-button {
        & svg {
          width: 16px;
          height: 16px;
        }
      }
    }
  `
})

export const MonacoActionsHeader = styled(Box)``

export const LangContainer = styled(Box)(({ theme }) => {
  return `
    width: 125px;
    position: relative;
    left: -${gutter.px};

    & .MuiInputBase-input {
      font-size: 12px;
      padding-top: ${gutter.qpx};
      padding-bottom: ${gutter.qpx};
    }

    & .MuiInputBase-root.tdsk-monaco-lang-select {
      background-color: transparent;

      & fieldset {
        border: None;
      }

      &:hover fieldset {
        border: 2px solid ${theme.palette.border.default}
      }
    }
  `
})

export const MonacoPlaceholder = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  return `
    z-index: 1;
    font-size: 14px;
    position: absolute;
    pointer-events: none;
    padding: ${gutter.px};
    background-color: transparent;
    color: ${isDark ? grey[700] : grey[300]};
    
    &.line-numbers {
      left: 30px;
    }
  `
})
