import type { ComponentType } from 'react'

import GoogleIcon from '@mui/icons-material/Google'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import { TDSK_SB_IMAGE_FULL } from '@TAF/constants/envs'
import { EProvider, ELLMProviderBrand } from '@tdsk/domain'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'

import {
  ZAIIcon,
  OpenAIIcon,
  OllamaIcon,
  AnthropicIcon,
  OpenRouterIcon,
} from '@tdsk/components'

export const ProviderTypes = Object.values(EProvider).map((value) => ({
  value,
  label: wordCaps(value),
}))

// All non-custom brands fetch models from backend (pi-mono static registry)
export const DynamicBrands = new Set<string>(
  Object.values(ELLMProviderBrand).filter((b) => b !== ELLMProviderBrand.custom)
)

// No brands need API keys for model listing (pi-mono's static registry)
export const KeyRequiredBrands = new Set<string>([])

export const ProviderIcons: Record<string, ComponentType<any>> = {
  [ELLMProviderBrand.zai]: ZAIIcon,
  [ELLMProviderBrand.google]: GoogleIcon,
  [ELLMProviderBrand.openai]: OpenAIIcon,
  [ELLMProviderBrand.ollama]: OllamaIcon,
  [ELLMProviderBrand.anthropic]: AnthropicIcon,
  [ELLMProviderBrand.openrouter]: OpenRouterIcon,
  [ELLMProviderBrand.custom]: SettingsSuggestIcon,
}

export const SBImagePresets = [
  { label: `Codex`, value: TDSK_SB_IMAGE_FULL },
  { label: `OpenCode`, value: TDSK_SB_IMAGE_FULL },
  { label: `Gemini CLI`, value: TDSK_SB_IMAGE_FULL },
  { label: `Claude Code`, value: TDSK_SB_IMAGE_FULL },
]
