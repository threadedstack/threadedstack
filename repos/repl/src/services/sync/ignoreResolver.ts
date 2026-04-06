import { DefSyncIgnores } from '@TRL/constants/sync'

type TResolveIgnoresOpts = {
  sandboxIgnores?: string[]
  configDefaultIgnores?: string[]
  ruleIgnores?: string[]
  skipDefaults?: boolean
}

export const resolveIgnores = (opts: TResolveIgnoresOpts): string[] => {
  const {
    sandboxIgnores = [],
    configDefaultIgnores = [],
    ruleIgnores = [],
    skipDefaults = false,
  } = opts

  // Separate negations from regular patterns in rule ignores
  const negations = ruleIgnores.filter((p) => p.startsWith('!')).map((p) => p.slice(1))
  const rulePositive = ruleIgnores.filter((p) => !p.startsWith('!'))

  // Build layers in resolution order
  const layers = [
    ...(skipDefaults ? [] : DefSyncIgnores),
    ...sandboxIgnores,
    ...configDefaultIgnores,
    ...rulePositive,
  ]

  // Remove patterns that match negations
  const filtered = layers.filter((p) => !negations.includes(p))

  // Deduplicate while preserving order
  return [...new Set(filtered)]
}
