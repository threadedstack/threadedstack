import { exists } from '@keg-hub/jsutils/exists'
import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'

export type THLoadDynamic = {
  name?: string
  loader?: () => Promise<Record<`default`, any>>
}

export const useLoadDynamic = (props: THLoadDynamic) => {
  const { loader, name } = props
  const [modules, setModules] = useState<Record<string, any>>({})

  useEffect(() => {
    loader &&
      name &&
      !exists(modules[name]) &&
      ife(async () => {
        const markdown = await loader()
        setModules({
          ...modules,
          [name]: markdown.default || false,
        })
      })
  }, [loader, name, modules])

  return modules[name] || undefined
}
