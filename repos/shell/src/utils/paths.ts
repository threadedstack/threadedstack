import hq from 'alias-hq'

const aliases = hq.get(`webpack`)

export const paths = {
  tdsk: aliases[`@ROOT`],
  root: aliases[`@TSH/root`],
  dist: aliases[`@TSH/dist`],
  configs: aliases[`@TSH/configs`],
}
