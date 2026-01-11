import { EProvider } from '@tdsk/domain'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'

export const ProviderTypes = Object.values(EProvider).map((value) => ({
  value,
  label: wordCaps(value),
}))
