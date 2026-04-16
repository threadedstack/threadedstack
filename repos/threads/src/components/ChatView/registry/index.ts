import type { ComponentType } from 'react'
import { GuiSelect } from './GuiSelect'
import { GuiConfirm } from './GuiConfirm'
import { GuiTextInput } from './GuiTextInput'
import { GuiAlert } from './GuiAlert'
import { GuiProgressBar } from './GuiProgressBar'

export const GuiComponentRegistry: Record<string, ComponentType<any>> = {
  Select: GuiSelect,
  Confirm: GuiConfirm,
  TextInput: GuiTextInput,
  Alert: GuiAlert,
  ProgressBar: GuiProgressBar,
}
