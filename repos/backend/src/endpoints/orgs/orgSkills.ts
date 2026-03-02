import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSkill } from '@TBE/endpoints/skills/getSkill'
import { listSkills } from '@TBE/endpoints/skills/listSkills'
import { createSkill } from '@TBE/endpoints/skills/createSkill'
import { updateSkill } from '@TBE/endpoints/skills/updateSkill'
import { deleteSkill } from '@TBE/endpoints/skills/deleteSkill'
import { attachSkill } from '@TBE/endpoints/skills/attachSkill'
import { detachSkill } from '@TBE/endpoints/skills/detachSkill'

export const orgSkills: TEndpointConfig = {
  path: `/:orgId/skills`,
  method: EPMethod.Use,
  endpoints: {
    listSkills,
    getSkill,
    createSkill,
    updateSkill,
    deleteSkill,
    attachSkill,
    detachSkill,
  },
}
