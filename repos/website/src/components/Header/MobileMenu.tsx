import Box from '@mui/material/Box'
import List from '@mui/material/List'
import Drawer from '@mui/material/Drawer'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router'
import ListItemText from '@mui/material/ListItemText'
import { TDSK_AD_APP_URL } from '@TAF/constants/envs'
import ListItemButton from '@mui/material/ListItemButton'

type Props = {
  open: boolean
  onClose: () => void
  navItems: { label: string; path: string }[]
}

const MobileMenu = ({ open, onClose, navItems }: Props) => (
  <Drawer
    open={open}
    anchor='right'
    onClose={onClose}
    PaperProps={{ sx: { width: 280, pt: 2 } }}
  >
    <List>
      {navItems.map((item) => (
        <ListItemButton
          to={item.path}
          key={item.path}
          onClick={onClose}
          component={RouterLink}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
    <Box sx={{ p: 2 }}>
      <Button
        fullWidth
        onClick={onClose}
        variant='contained'
        href={TDSK_AD_APP_URL}
      >
        Get Started
      </Button>
    </Box>
  </Drawer>
)

export default MobileMenu
