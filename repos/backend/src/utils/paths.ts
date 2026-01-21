import hq from 'alias-hq'
export const aliases = hq.get(`webpack`)

export const paths = {
  tdsk: aliases[`@ROOT`],
  deploy: aliases[`@TSR/deploy`],
  public: aliases[`@TBE/public`],
  configs: aliases[`@TBE/configs`],
}
