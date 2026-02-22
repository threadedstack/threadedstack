# TODO

The following are a list of confirmed issues found or required updates across the mono-repo


## Backend

* **List endpoint pagination**: GET .../members echoes limit/offset as metadata but doesn't apply them to the data array. This is a known backend gap but not a correctness issue.


## Admin

* **Admin UI for API key management**:
  * Add admin UI to allow org owner/super users to create API keys for org and project members (Users).
  * Could be added to both the Org APIKeys page and in the User Drawer from the Org Members page when editing a user
  * **IMPORTANT** - Requires updates across multiple sub repos (i.e. admin, backend, database)

* **Agents**
  * Agents in projects should not show Project assignments

* **Endpoints**
  * Add Test button to Proxy Endpoints
    * Allows calling the proxied endpoint
    * Display the response in a Non-Editable Monaco Editor
      * Monaco Editor language should match the response `content-type`
        * `content-type: text/html` => HTML
        * `content-type: application/json` => JSON 
  * Add Test button to Function Endpoints
    * Allows calling the function endpoint and returns the response
    * Display the response in a Non-Editable Monaco Editor
      * Monaco Editor language should match the response `content-type`
        * `content-type: text/html` => HTML
        * `content-type: application/json` => JSON 