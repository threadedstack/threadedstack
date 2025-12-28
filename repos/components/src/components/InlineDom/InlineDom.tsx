import type { CSSProperties } from "react"

import Box from '@mui/material/Box'
import convert from 'react-from-dom'
import { useState, useEffect } from "react"


export type TInlineDom = {
  id?:string
  html:string
  className?:string
  sx?:CSSProperties
}

export const InlineDom = (props:TInlineDom) => {
  const {
    sx,
    id,
    html,
    className
  } = props

  const [converted, setConverted] = useState<any>(undefined)

  useEffect(() => {
    if(converted) return
    const output = convert(html)
    setConverted(output)
  }, [html, converted])

  return (
    <Box
      id={id}
      sx={sx}
      className={className}
    >
      {converted}
    </Box>
  )
  
}