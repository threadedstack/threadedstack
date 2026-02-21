# TODO

The following are a list of confirmed issues found across the mono-repo

## Admin

### Token Expired

* The authentication system in the admin ui uses neon auth via the `@neondatabase/neon-js/auth`
* This works well, but the auth token is not automatically refreshed
* This causes occasional errors because once the token expires and a request is made it automatically fails
* Refreshing the browser page fixes the issue because that causes the token to be refreshed


### AgentDrawer

* **Secrets**
  * In the Organization AgentDrawer, the associated Secrets section shows a list of secrets linked to the Agent.
  * When if a secret is removed, and the updates to the agent are saved, the secret is not actually removed from the agent
  * **IMPORTANT** - Fixing this requires updates across multiple sub repos (i.e. admin, backend, database)
* **Projects**
  * The Projects AgentDrawer has full access to modify the Agent, even though it does not belong to only this project
  * Agents are shared across projects, but projects should not be allowed to modify Agents config that could impact other projects with access to the same agent.
    * Instead Projects AgentDrawer allow creating overrides that overrides the default agent settings with it's own project specfic settings
    * This would also solve the other custom tool/functions issue, where functions are project scoped but tied to Agents which are Organization scoped.
      * At the Project level, Project scoped functions could be added to the agent
      * The UI would need to be updated so adding functions is only displayed in the Project AgentDrawer
  * **IMPORTANT** - Fixing this requires updates across multiple sub repos (i.e. admin, backend, database)


## Repl

* **Projects**
  * When a user runs the CLI it should do the following
    * If a project id is not set in the config
      * It should show the user an interactive list of Projects to select from.
        * It should only show projects the user has access to for the organization they have authenticated with
      * The user can use the `up` and `down` keys to select a project
      * Pressing enter will make that project active
    * If a project id is set in the config, the project select is skipped
    * Once a project is active either through the config, or being selected from a list
      * If a agent id is not set in the config
        * The user should be shown a list of agents to select from
        * Only agents from the active project should be displayed
      * If a agent id is set in the config, the agent select is skipped

* **Slash Commands**
  * Add a new slash command `/projects`
    * This should show an interactive menu list of projects the user has access to for the organization
    * Using `up` and `down` keys, the user should be able to select a project which impacts which agents they have access to
  * Calling the `/threads` command currently just shows a list of threads, instead it should
    * Show an interactive menu that allows the user to select from the list of threads using `up` and `down` keys
    * When the user finds the thread they want, pressing enter loads the thread
      * Loading a thread should include adding all previous message to the message history.
      * Once loaded the user should be able to scroll through the threads messages
    * Pressing `esc` will exit the select thread menu
    * Pressing `cmd-d` when a thread is highlighted should then show a `Delete Thread` confirmation window
      * Selecting `Yes` and pressing enter should delete the thread
      * Selecting `No` and pressing enter should exit back to the thread list menu
        * Pressing `esc` should to the same as selecting `No`
  * Calling the `/switch` command **without** a thread-id should show the same thread select menu that the `/threads` command displays
  * Calling `/clear` should not just clear the screen
    * It should clear the screen and create a brand new thread and set it as the active thread
    * The new thread should have the same configuration as the current thread but with out any context, or previous messages
  * Calling `/agent` command **without** an agent-id should show
    * Show an interactive menu that allows the user to select from the list of agents using `up` and `down` keys
    * Only agents of the currently active project should be displayed

* **Prompt Input**
  * Pressing the `delete` key when the user is writing in prompt input should delete the character that comes immediately before the current cursor location. It should **NOT** delete the at the same location as the cursor
  * At the same time, pressing the `delete` key should move the cursor back one character, implementing both of these means the cursor would still be directly over the same character, and the character previous to it would be removed. This is a standard implementation across all UI inputs, so it should be reflected here as well.


* **Chat Session UI**
  * There's a lot of session, project, and agent meta-data that could be included directly below the the Prompt input so the user does not need to always use slash commands to find it.
  * We need to review what information would be useful to the user at a quick glance and ensure it's always presented directly below the Prompt Input