import { Label } from '@TSC/components/Text/TextElements'
import { cmx, colors, dims, grey, gutter } from '@TSC/theme'
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion
    disableGutters
    elevation={0}
    square
    {...props}
  />
))(({ theme }) => {
  return `
    min-height: 24px;
    border-bottom: 1px solid ${theme.palette.border.default};

    &::before {
      display: none;
    }

    & .MuiAccordion-region {
      height: 100%;
    }

    &.tdsk-accordion-bottom-border .MuiCollapse-root {
      &.MuiCollapse-entered {
        border-bottom: 1px solid ${theme.palette.border.default};
      }
    }
    
    &:last-of-type {
      border-bottom-left-radius: 0px;
      border-bottom-right-radius: 0px;
    }

  `
})

export const AccordionSummary = styled(MuiAccordionSummary)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const closedColor = isDark ? grey[700] : grey[400]
  const openColor = isDark ? grey[200] : grey[800]
  const icnOpenColor = isDark ? colors.primary[600] : colors.primary[500]

  return `
    flex-direction: row-reverse;
    padding-top: ${gutter.hpx};
    padding-bottom: ${gutter.hpx};
    min-height: ${dims.dropdown.header.px};
    
    &:hover {
    
      & .tdsk-thread-section-actions-container {
        opacity: 1;
        pointer-events: inherit;
      }
    
      & .MuiAccordionSummary-expandIconWrapper {
        color: ${icnOpenColor};
      }
    
      & .MuiAccordionSummary-content {
        color: ${openColor};
      }
      & .MuiSvgIcon-root {
        color: ${icnOpenColor};
      }
    }

    & .MuiAccordionSummary-expandIconWrapper {
      color: ${closedColor};
      transition: color 0.4s ease;

      &.Mui-expanded {
        transform: rotate(90deg);
        color: ${icnOpenColor};
      }
    }

    & .MuiAccordionSummary-content {
      cursor: pointer;
      color: ${closedColor};
      transition: color 0.4s ease;
      align-items: center;
      justify-content: space-between;

      & .MuiTypography-root.open {
        color: ${openColor};
      }
      & .MuiBox-root.open svg {
        color: ${icnOpenColor};
      }
    }
  `
})

export const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => {
  return `
    padding: 0px;
    height: 100%;
    border-top: 1px solid ${theme.palette.border.default};
  `
})

export const AccordionHeader = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
    justify-content: start;
  `
})

export const AccordionTitle = styled(Label)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const openColor = isDark ? grey[200] : grey[800]

  return `
    &.colored {
      color: inherit;
    }

    cursor: pointer;
    font-size: 14px;
    font-weight: bold;

    &.open.colored {
      color: ${openColor} !important;
    }
  `
})

export const AccordionIconContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const openColor = isDark ? colors.primary[600] : colors.primary[500]

  return `
    height: 23px;
    width: 24px;
    margin-right: ${gutter.hpx};
    & svg {
      width: 24px;
      height: 24px;
    }

    &.open svg {
      color: ${openColor} !important;
    }
    
  `
})
