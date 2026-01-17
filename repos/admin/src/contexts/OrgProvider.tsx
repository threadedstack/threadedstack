import type { ReactNode } from 'react'

import { OrgContext } from '@TAF/contexts/OrgContext'
import { MemoChildren, Loading } from '@tdsk/components'
import { useOrgState } from '@TAF/hooks/org/useOrgState'
import { AppError } from '@TAF/components/AppError/AppError'

export type TOrgProvider = {
  children: ReactNode
}

export const OrgProvider = (props: TOrgProvider) => {
  const data = useOrgState()
  const { org, error } = data

  return (
    <OrgContext.Provider value={data}>
      {org ? (
        <MemoChildren>{props.children}</MemoChildren>
      ) : error ? (
        <AppError message={error} />
      ) : (
        <Loading
          fixed
          full
        />
      )}
    </OrgContext.Provider>
  )
}
