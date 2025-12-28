import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export const TabsContainer = styled(Box)`

 & .MuiTab-root {
    .MuiBadge-badge {
      top: -3px;
      right: -3px;
      opacity: 0.3;
      font-size: 10px;
      width: 14px;
      height: 14px;
      min-width: 14px;
      transition: opacity 0.4s ease;
    }
    &:hover {
      .MuiBadge-badge {
        opacity: 1;
      }
    }
    &.Mui-selected {
      .MuiBadge-badge {
        opacity: 1;
      }
    }
 }

`

export const TabBadge = styled(Badge)`



`
