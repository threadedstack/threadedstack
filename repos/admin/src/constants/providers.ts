import type { ComponentType } from 'react'

import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import { EProvider, ELLMProviderBrand } from '@tdsk/domain'

import {
  ZAIIcon,
  OpenAIIcon,
  OllamaIcon,
  AnthropicIcon,
  OpenRouterIcon,
} from '@tdsk/components'

import HubIcon from '@mui/icons-material/Hub'
import BoltIcon from '@mui/icons-material/Bolt'
import GoogleIcon from '@mui/icons-material/Google'
import TerminalIcon from '@mui/icons-material/Terminal'
import PsychologyIcon from '@mui/icons-material/Psychology'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'

export const ProviderTypes = Object.values(EProvider).map((value) => ({
  value,
  label: wordCaps(value),
}))

export const DynamicBrands = new Set<string>([
  ELLMProviderBrand.openai,
  ELLMProviderBrand.google,
  ELLMProviderBrand.ollama,
  ELLMProviderBrand.openrouter,
])

// Brands that need the user's API key to fetch models
export const KeyRequiredBrands = new Set<string>([
  ELLMProviderBrand.openai,
  ELLMProviderBrand.google,
])

export const ProviderIcons: Record<string, ComponentType<any>> = {
  [ELLMProviderBrand.zai]: ZAIIcon,
  [ELLMProviderBrand.google]: GoogleIcon,
  [ELLMProviderBrand.openai]: OpenAIIcon,
  [ELLMProviderBrand.ollama]: OllamaIcon,
  [ELLMProviderBrand.anthropic]: AnthropicIcon,
  [ELLMProviderBrand.openrouter]: OpenRouterIcon,
  [ELLMProviderBrand.custom]: SettingsSuggestIcon,
}
