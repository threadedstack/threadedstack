import { useAtom } from 'jotai'
import IconButton from '@mui/material/IconButton'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { themeTypeAtom } from '@TAF/state/theme'

const ThemeToggle = () => {
  const [type, setType] = useAtom(themeTypeAtom)

  return (
    <IconButton
      onClick={() => setType(type === 'dark' ? 'light' : 'dark')}
      sx={{ color: 'text.secondary' }}
      size='small'
    >
      {type === 'dark' ? (
        <LightModeIcon fontSize='small' />
      ) : (
        <DarkModeIcon fontSize='small' />
      )}
    </IconButton>
  )
}

export default ThemeToggle
