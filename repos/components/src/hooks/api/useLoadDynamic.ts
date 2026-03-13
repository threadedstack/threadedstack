import { ife } from '@keg-hub/jsutils/ife'
import { useEffect, useState } from 'react'
import { exists } from '@keg-hub/jsutils/exists'

export type THLoadDynamic = {
  name?: string
  loader?: () => Promise<Record<`default`, any>>
}

export const useLoadDynamic = (props: THLoadDynamic) => {
  const { loader, name } = props
  const [modules, setModules] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!loader || !name || exists(modules[name])) return

    ife(async () => {
      const loaded = await loader()
      setModules({
        ...modules,
        [name]: loaded.default || false,
      })
    })
  }, [loader, name, modules])

  return modules[name] || undefined
}
