import type { ComponentType } from 'react'
import type { TProviderLabel } from '@TAF/types'

import CodeIcon from '@mui/icons-material/Code'
import GitHubIcon from '@mui/icons-material/GitHub'
import GoogleIcon from '@mui/icons-material/Google'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'
import {
  EProvider,
  EGitProvider,
  EAIProviderBrand,
  EDockerProviderBrand,
  GitProviderTemplates,
  DockerRegistryDefaults,
} from '@tdsk/domain'

import {
  ZAIIcon,
  OpenAIIcon,
  OllamaIcon,
  DeepSeekIcon,
  AnthropicIcon,
  OpenRouterIcon,
} from '@tdsk/components'

export const ProviderTypes = Object.values(EProvider).map((value) => ({
  value,
  label: wordCaps(value),
}))

export const DockerProviderOptions = Object.values(EDockerProviderBrand).map((value) => ({
  value,
  label: DockerRegistryDefaults[value]?.name || wordCaps(value),
}))

export const GitProviderOptions = Object.values(EGitProvider).map((value) => ({
  value,
  label: GitProviderTemplates[value]?.name || wordCaps(value),
}))

// All non-custom brands fetch models from backend (pi-mono static registry)
export const DynamicBrands = new Set<string>(
  Object.values(EAIProviderBrand).filter((b) => b !== EAIProviderBrand.custom)
)

// No brands need API keys for model listing (pi-mono's static registry)
export const KeyRequiredBrands = new Set<string>([])

export const ProviderIcons: Record<string, ComponentType<any>> = {
  [EGitProvider.gitea]: CodeIcon,
  [EGitProvider.gitlab]: CodeIcon,
  [EGitProvider.github]: GitHubIcon,
  [EGitProvider.bitbucket]: CodeIcon,
  [EGitProvider.azureDevops]: CodeIcon,
  [EAIProviderBrand.zai]: ZAIIcon,
  [EAIProviderBrand.google]: GoogleIcon,
  [EAIProviderBrand.openai]: OpenAIIcon,
  [EAIProviderBrand.ollama]: OllamaIcon,
  [EAIProviderBrand.deepseek]: DeepSeekIcon,
  [EAIProviderBrand.anthropic]: AnthropicIcon,
  [EAIProviderBrand.openrouter]: OpenRouterIcon,
  [EAIProviderBrand.custom]: SettingsSuggestIcon,
}

export const ProviderTypeLabels: Record<string, TProviderLabel> = {
  ai: {
    title: `AI Providers`,
    label: `AI Providers`,
    desc: `Select AI providers for this entity`,
    empty: `No AI providers available. Create a provider first.`,
  },
  git: {
    title: `Git Providers`,
    label: `Git Providers`,
    desc: `Select git providers for this entity`,
    empty: `No git providers available. Create a provider first.`,
  },
  docker: {
    title: `Docker Registries`,
    label: `Docker Registries`,
    desc: `Select docker registries for this entity`,
    empty: `No docker registries available. Create a provider first.`,
  },
}

export const DefProvidersLabel = {
  title: `Providers`,
  label: `Providers`,
  desc: `Select providers for this entity`,
  empty: `No providers available. Create a provider first.`,
}

export const DefProviderLabel = {
  title: `Providers`,
  label: `Provider`,
  desc: `Select a provider`,
  empty: `No providers available.`,
}
