import type { TPayPlans } from '@TDM/types'

export const parsePayPlans = (plans: string = ``) => {
  if (!plans?.trim()) return {} as TPayPlans

  return plans.split(`,`).reduce((acc, part) => {
    const [name, id] = part
      .split(`=`)
      .filter(Boolean)
      .map((item) => item.trim())

    if (!name) throw new Error(`Pay plan is missing a valid "name" for id "${id}"`)
    if (!id) throw new Error(`Pay plan is missing a valid "id" for name "${name}"`)
    if (acc[name]) throw new Error(`Pay plan name "${name}" for id "${id}" is duplicated`)
    if (Object.values(acc).includes(id))
      throw new Error(`Pay plan id "${id}" for name "${name}" is duplicated`)

    acc[name] = id

    return acc
  }, {} as TPayPlans)
}
