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
* Configs are not being used, and should be removed


### Agent
 Follow-up: Runtime header injection (not in this PR)

 The agent LLM adapters (repos/agent/src/llm/) will need to consume provider.headers
 at runtime:
 - OpenAICompatibleAdapter.getHeaders() — merge config.options?.headers with defaults
 - AnthropicAdapter — pass custom headers via Anthropic SDK's defaultHeaders
 - Backend AI session creation — include provider headers in TLLMAdapterConfig.options

 This is a separate concern from the admin UI and tracked as a follow-up.
 
 
### Repl
* Add ability to generate session token via browser login
  * cross repo, requires updates to admin sub-repo
* Improve the chat interface
  * Add spinner when waiting on AI
  * Add automatic loading of local files, (i.e. AGENTS.md, skills, MCP, etc.)
  * Add hooks that can be configured next to the config file
  * Extend config file to allow setting config options for sandbox environment