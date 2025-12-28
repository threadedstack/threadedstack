import type { ComponentProps } from 'react'

import { grey, dims } from '@TSC/theme'
import { H5 } from '@TSC/components/Text'
import { styled } from '@mui/material/styles'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'

type THeaderProps = ComponentProps<typeof AccordionSummary> & {
  transformOn?:number
  transformOff?:number
  noIconTransform?:boolean
}

export const Container = styled(Accordion)(({ theme }) => {
  return `
  width: 100% !important;
  &.disabled {
    opacity: 0.5;
    pointer-events: none;
    
    & h5 {
      color: ${grey[500]}
    }
  }
`
})


const noProps = [
  `transformOn`,
  `transformOff`,
  `noIconTransform`
]

export const Header = styled(AccordionSummary, {
  shouldForwardProp: (prop) => !noProps.includes(prop as any),
})((props: THeaderProps) => {

  const {
    transformOn=0,
    transformOff=-90,
    noIconTransform=true,
  } = props

  const [on, off] = noIconTransform
    ? [`transform: rotate(${transformOn}deg);`, `transform: rotate(${transformOff}deg);`]
    : [`transform: none;`, `transform: none;`]

  return `
    opacity: 0.7;
    cursor: pointer;
    position: relative;
    height: ${dims.dropdown.header.px};
    min-height: ${dims.dropdown.header.px};

    & .MuiAccordionSummary-root {
      padding: 0px;
    }

    &.Mui-expanded {
      opacity: 1;
    }

    &:hover {
      opacity: 1;
    }

    & .MuiAccordionSummary-expandIconWrapper {
      color: inherit;
      ${off}

      &.Mui-expanded {
        ${on}
      }

      & .MuiSvgIcon-root {
        color: currentColor;
      }
    }

    & .MuiAccordionSummary-content: {
      margin: 0px;

      & label: {
        cursor: pointer;
      }
    }

  `
})

export const HeaderText = styled(H5)`
  flex-grow: 1;
  display: flex;
  font-size: 14px;
  align-items: center;
  color: currentColor;
  height: ${dims.dropdown.header.px};
`

export const Body = styled(AccordionDetails)(({ theme }) => {
  
  return `
    border-top: 1px solid ${theme.palette.border.default};
  `

})