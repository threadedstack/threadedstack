## TODO


### Admin

* Secrets UI doesn't update when performing CRUD on a secret
* Providers UI in admin repo needs cleaned up
  * It should use a table like the ApiKeys page
    * It should display the provider name properly
    * In the provider Drawer, there's no way to link secrets to a provider 
    * Right now this can only be done via the quickstart drawer
* The quickstart drawer UI needs cleaned up
  * It's very boring and the actions buttons are not placed correctly
  * They should follow the same pattern as other drawers
* Org Usage doesn't load from the UI, shows error:
'Error: Status: 422 - {"error":"RequestValidationError","detail":[{"type":"uuid_parsing","loc":["path","id"],"msg":"Input should be a valid UUID, invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `p` at 1","input":"polar_price_pro_monthly","ctx":{"error":"invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `p` at 1"}}]}\



### ALL
* Providers should only be tied to Organization
  * Figure out why they are tied to users / projects and remove them
* Configs are not being used, and should be removed
