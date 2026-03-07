import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { Link as RouterLink } from 'react-router'

type Props = {
  open: boolean
  onClose: () => void
  navItems: { label: string; path: string }[]
}

const MobileMenu = ({ open, onClose, navItems }: Props) => (
  <Drawer
    anchor='right'
    open={open}
    onClose={onClose}
    PaperProps={{ sx: { width: 280, pt: 2 } }}
  >
    <List>
      {navItems.map((item) => (
        <ListItemButton
          key={item.path}
          component={RouterLink}
          to={item.path}
          onClick={onClose}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
    <Box sx={{ p: 2 }}>
      <Button
        component={RouterLink}
        to='/docs/getting-started'
        variant='contained'
        fullWidth
        onClick={onClose}
      >
        Get Started
      </Button>
    </Box>
  </Drawer>
)

export default MobileMenu
