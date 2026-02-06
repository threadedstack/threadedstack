# Proxy Endpoints


## Properties

* **method**
  * Http method (`get`, `post`, `put`, `delete`, `head`, `options`)
  * The `method` property exists in both `endpoint` and `proxy endpoint options`
    * At the endpoint level its the method to call the endpoint
    * At the options level its the method used when proxying the request for the proxy
      * So technically one could proxy a `get` request to a `post` request
