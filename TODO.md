## TODO


### Admin

* Endpoints
  * Sometimes navigating to Endpoints page doesn't load the Endpoints
    * Shows spinner forever
    * Refresh fixes it
  * Agent type
    * Basically all options in AgentDrawer should be exposed to Agent Overrides
    * Allow selecting custom function tools in agent overrides
    * Allow overriding AI provider options
    * Allow overriding Exposed secrets
  * Function Type
    * If no functions exist - Tell user to create a function first
    * Functions don't load when creating a new Endpoint
    * Can't create a new Faas Endpoint because Functions don't load
      * Selecting a function is required
  * Proxy Type
    * Too many options, Not easy to configure, Need to simplify
* The quickstart drawer UI needs cleaned up
  * It's very boring and the actions buttons are not placed correctly
  * They should follow the same pattern as other drawers
* Figure out Loading Projects
* The Agent, Thread and Chat page need cleaned up
  * Agent Drawer
    * That's of errors and warnings when opening
    * Associated Secrets uses SwitchInput for each search
      * Should work the same as ToolsSelector in Available Tools section
      * Update SecretsSelector to work the same as ToolsSelector
    * Extract the Custom Functions section into it's own FunctionsSelector
      * Should work the same as ToolsSelector in Available Tools section
  * Thread
    * When viewing a Thread history, AI messages are squished
    * Edit Thread Drawer is completely messed up
      * UI all squished together
    * Threads page has an Agent selector
      * This should be an AI provider selector instead
      * Allow easy switching of AI providers attached to an agent 
  * Chat
    * AI messages are squished to the right
* Agent Page
  * Uses cards to display list of Agents
    * Should use a Table like of the entity pages
* Functions Page
  * Convert from cards list to Table like other sections 
* Sidebar nav
  * Sub Agents under the Agents Nav item get cut off
    * Can't see full name, need a solution for nav sub items
  * Simplify - TOO MANY ITEMS
* Org page
  * Doesn't show Org members
    * Just shows an empty list
* Users
  * Update to be a table instead of UserCard

#### Work

* Create Selector components for Providers, Agents, Functions, Endpoints, Secrets, ENVs
  * Reuse the Selector component across entities Drawers for consistency
  * Ensure item can be selected and loaded and linked to each other



### ALL
* Figure out data model an relationships
  * Domains to Orgs, Projects
  * Users to Orgs, Projects
  * Providers to Orgs, Projects, Agents
    * Allow Agents to quick switch between providers
  * Agents to Orgs, Projects
  * Functions to Endpoints, Agents
  * Endpoints to Functions, Proxy, Agents
  * Secrets to Agents, Endpoints, Functions
* This will impact Admin UI and navigation
* Plans and Subscriptions are not working as expected
  * Don't load properly in admin UI
  * Properly not loading properly from backend
  * Need to switch to Stripe instead
  * Whole implementation needs to be refactored

### Agent
* Add open-router and ollama support

 
### Repl
* Add ability to generate session token via browser login
  * cross repo, requires updates to admin sub-repo
  * Should respect .gitignore files
* Improve the chat interface
  * Add spinner when waiting on AI
  * Add automatic loading of local files, (i.e. AGENTS.md, skills, MCP, etc.)
  * Add hooks that can be configured next to the config file
  * Extend config file to allow setting config options for sandbox environment