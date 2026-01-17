import type { ReactNode } from 'react'

import { OrgsContext } from '@TAF/contexts/OrgsContext'
import { MemoChildren, Loading } from '@tdsk/components'
import { useOrgsState } from '@TAF/hooks/org/useOrgsState'
import { AppError } from '@TAF/components/AppError/AppError'

export type TOrgsProvider = {
  children: ReactNode
}

export const OrgsProvider = (props: TOrgsProvider) => {
  const data = useOrgsState()
  const { orgs, error } = data

  return (
    <OrgsContext.Provider value={data}>
      {orgs ? (
        <MemoChildren>{props.children}</MemoChildren>
      ) : error ? (
        <AppError message={error} />
      ) : (
        <Loading
          fixed
          full
        />
      )}
    </OrgsContext.Provider>
  )
}
