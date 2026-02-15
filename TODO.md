## TODO


### Admin

* Secrets UI doesn't update when performing CRUD on a secret
* The quickstart drawer UI needs cleaned up
  * It's very boring and the actions buttons are not placed correctly
  * They should follow the same pattern as other drawers
* Add agent page that displays agent metadata and information. No page currently exists, but a Nav route does, so when it's clicked it routes back to the home page which is a bad user experience.


### ALL


### Agent
* Add open-router and ollama support

 
### Repl
* Add ability to generate session token via browser login
  * cross repo, requires updates to admin sub-repo
* Improve the chat interface
  * Add spinner when waiting on AI
  * Add automatic loading of local files, (i.e. AGENTS.md, skills, MCP, etc.)
  * Add hooks that can be configured next to the config file
  * Extend config file to allow setting config options for sandbox environment