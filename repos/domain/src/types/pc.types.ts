declare module '@keg-hub/parse-config' {

  function loadEnvSync(...args:any[]): any
  function loadEnv(...args:any[]): Promise<any>

  function parseEnv(...args:any[]): any
  function stringifyEnv(...args:any[]): any
  function writeEnv(...args:any[]): Promise<any>
  function mergeEnv(...args:any[]): Promise<any>
  function removeEnv(...args:any[]): Promise<any>

  function loadConfigs(...args:any[]): any
  function execTemplate(...args:any[]): any
  function fillTemplateSync(...args:any[]): any
  function setDefaultPattern(...args:any[]): any
  function fillTemplate(...args:any[]): Promise<any>

  function loadYmlSync(...args:any[]): any
  function loadYml(...args:any[]): Promise<any>
  function mergeYml(...args:any[]): Promise<any>
  function writeYml(...args:any[]): Promise<any>
  function removeYml(...args:any[]): Promise<any>

}

export {}