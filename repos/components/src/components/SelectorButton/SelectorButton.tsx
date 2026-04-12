import type { MouseEvent, ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { Text } from '@TSC/components/Text'
import { Button } from '@TSC/components/Buttons'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

const styles = {
  text: {
    fontWeight: 500,
    maxWidth: 150,
    overflow: `hidden`,
    whiteSpace: `nowrap`,
    textOverflow: `ellipsis`,
  },
  button: {
    color: `text.primary`,
    textTransform: `none`,
    [`&.open .MuiButton-endIcon`]: {
      transform: `rotate(180deg)`,
    },
    [`& .MuiButton-endIcon`]: {
      transform: `rotate(0deg)`,
      transition: `transform 0.2s ease`,
    },
  },
}

export type TSelectorButton = {
  icon?: ReactNode
  text?: string
  open?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
  placeholder?: string
}

export const SelectorButton = (props: TSelectorButton) => {
  const { icon, text: label, open, onClick, className, placeholder = `Select...` } = props

  return (
    <Button
      onClick={onClick}
      sx={styles.button}
      EndIcon={<ExpandMoreIcon />}
      className={cls(className, open && `open`)}
    >
      {icon}
      <Text
        variant='body2'
        sx={styles.text}
      >
        {label || placeholder}
      </Text>
    </Button>
  )
}
