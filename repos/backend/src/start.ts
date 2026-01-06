import { main } from '@TBE/main'
import { ife } from '@keg-hub/jsutils/ife'
import { config } from '@TBE/configs/backend.config'

ife(async () => main(config))
