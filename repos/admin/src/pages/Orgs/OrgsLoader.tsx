import type { ReactNode } from 'react'
import { OrgsProvider } from '@TAF/contexts/OrgsProvider'

export type TOrgsLoader = {
  children?: ReactNode
}

export const OrgsLoader = (props: TOrgsLoader) => {
  return <OrgsProvider>{props.children}</OrgsProvider>
}

export default OrgsLoader
