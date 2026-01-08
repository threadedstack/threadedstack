import { proxy } from '@TPX/proxy'
import { ife } from '@keg-hub/jsutils/ife'
import { config } from '@TPX/configs/proxy.config'

ife(async () => proxy(config))
