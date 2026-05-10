import { isStr } from '@keg-hub/jsutils/isStr'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import type { EProvider } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'

export type TValidProviderType = {
  type: string
  brand: string
  providers: string[]
  provider: EProvider
}

export const isProviderType = (props: TValidProviderType) => {
  const { type, provider, brand, providers } = props
  if (type !== provider) return

  if (!brand || !isStr(brand) || !providers.includes(brand))
    throw new Exception(
      400,
      `${capitalize(provider)} providers require brand to be one of: ${providers.join(`, `)}` +
        (brand ? `. Got: "${brand}"` : ``)
    )
}
