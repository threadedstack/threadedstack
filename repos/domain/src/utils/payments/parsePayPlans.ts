import type { TPayPlans, TParsedPayPlans } from '@TDM/types'

export const parsePayPlans = (plans: string = ``): TParsedPayPlans => {
  if (!plans?.trim()) return { priceIds: {} as TPayPlans, seatPriceIds: {} as TPayPlans }

  const priceIds = {} as TPayPlans
  const seatPriceIds = {} as TPayPlans

  plans.split(`,`).forEach((part) => {
    const [name, value] = part.split(`=`).map((item) => item.trim())

    if (!name) throw new Error(`Pay plan is missing a valid "name" for value "${value}"`)
    if (!value) throw new Error(`Pay plan is missing a valid "id" for name "${name}"`)
    if (priceIds[name]) throw new Error(`Pay plan name "${name}" is duplicated`)

    const [priceId, seatPriceId] = value.split(`:`).map((s) => s.trim())

    if (!priceId) throw new Error(`Pay plan is missing a valid "id" for name "${name}"`)
    if (Object.values(priceIds).includes(priceId))
      throw new Error(`Pay plan id "${priceId}" for name "${name}" is duplicated`)

    priceIds[name] = priceId

    if (seatPriceId) seatPriceIds[name] = seatPriceId
  })

  return { priceIds, seatPriceIds }
}
