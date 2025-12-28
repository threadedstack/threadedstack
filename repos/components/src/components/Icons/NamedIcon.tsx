import type { CSSProperties } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'

import { forwardRef } from 'react'
import * as InternalIcons from './index'

// List of almost all Icons already imported into the app
// Does not increase bundle size, because they are already being used
import Info from '@mui/icons-material/Info'
import Save from '@mui/icons-material/Save'
import Tune from '@mui/icons-material/Tune'
import Menu from '@mui/icons-material/Menu'
import Apps from '@mui/icons-material/Apps'
import Edit from '@mui/icons-material/Edit'
import Error from '@mui/icons-material/Error'
import Close from '@mui/icons-material/Close'
import Check from '@mui/icons-material/Check'
import Block from '@mui/icons-material/Block'
import Title from '@mui/icons-material/Title'
import Logout from '@mui/icons-material/Logout'
import Shield from '@mui/icons-material/Shield'
import Google from '@mui/icons-material/Google'
import GitHub from '@mui/icons-material/GitHub'
import MCancel from '@mui/icons-material/Cancel'
import TaskAlt from '@mui/icons-material/TaskAlt'
import Settings from '@mui/icons-material/Settings'
import Schedule from '@mui/icons-material/Schedule'
import AutoMode from '@mui/icons-material/AutoMode'
import DataArray from '@mui/icons-material/DataArray'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import PlayCircle from '@mui/icons-material/PlayCircle'
import RestartAlt from '@mui/icons-material/RestartAlt'
import DataObject from '@mui/icons-material/DataObject'
import ContentCopy from '@mui/icons-material/ContentCopy'
import EditCalendar from '@mui/icons-material/EditCalendar'
import DarkMode from '@mui/icons-material/DarkModeOutlined'
import LibraryBooks from '@mui/icons-material/LibraryBooks'
import ContentPaste from '@mui/icons-material/ContentPaste'
import HighlightOff from '@mui/icons-material/HighlightOff'
import DirectionsRun from '@mui/icons-material/DirectionsRun'
import DragIndicator from '@mui/icons-material/DragIndicator'
import NotInterested from '@mui/icons-material/NotInterested'
import LightMode from '@mui/icons-material/LightModeOutlined'
import DeleteForever from '@mui/icons-material/DeleteForever'
import AddCircleOutline from '@mui/icons-material/AddCircleOutline'
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'
import RemoveCircleOutline from '@mui/icons-material/RemoveCircleOutline'

type RemoveEndIcon<T, End extends string> = {
  [K in keyof T as K extends `${infer Rest}${End}` ? Rest : K]: T[K]
}
type TransformedIcons = RemoveEndIcon<typeof InternalIcons, `Icon`>

const Renamed = Object.entries(InternalIcons)
  .reduce((acc, [name, func]) => {
    const clean = name.replace(/Icon$/, ``)
    clean && (acc[clean] = func)

    return acc
  }, {} as TransformedIcons)



export const IconList = {
  ...Renamed,
  Info,
  Save,
  Tune,
  Menu,
  Apps,
  Edit,
  Error,
  Close,
  Check,
  Block,
  Title,
  Logout,
  Shield,
  Google,
  GitHub,
  MCancel,
  TaskAlt,
  Settings,
  Schedule,
  AutoMode,
  DarkMode,
  LightMode,
  DataArray,
  MoreHoriz,
  PlayCircle,
  RestartAlt,
  DataObject,
  ExpandLess,
  ExpandMore,
  ContentCopy,
  EditCalendar,
  LibraryBooks,
  ContentPaste,
  HighlightOff,
  DirectionsRun,
  DragIndicator,
  NotInterested,
  DeleteForever,
  AddCircleOutline,
  KeyboardArrowDown,
  PlayCircleOutline,
  CheckCircleOutline,
  HelpOutlineOutlined,
  RemoveCircleOutline,
}

type TRenderIcon = Omit<SvgIconProps, `sx`> & {
  sx?:CSSProperties
  icon:keyof typeof IconList
}

export const NamedIcon = forwardRef<SVGSVGElement>((props: TRenderIcon, ref) => {
  const { icon, ...rest } = props
  const Icon = IconList[icon]
  return Icon && (<Icon ref={ref} {...rest} />) || null
})
