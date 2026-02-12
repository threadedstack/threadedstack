/**
 * This is a test script to validate loading AI models form open-router or vercel
 * At some point this should be implement and use to dynamically load the models
 * Will need to figure out which models we will support and how to best load them dynamically
 * This is just a proof endpoints exist that they can be loaded form
 */

import { ife } from '@keg-hub/jsutils/ife'

ife(async () => {
  const or = `https://openrouter.ai/api/v1/models`
  const vercel = `https://ai-gateway.vercel.sh/v1/models`

  await fetch(or)
    .then(async (resp) => await resp.json())
    .then((models) => {
      console.log(`------- models -------`)
      console.log(models)
    })
    .catch((err) => {
      console.error(err)
    })
})
