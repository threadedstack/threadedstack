# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.


## Backend

### Custom Endpoints

* There are three custom endpoints types (agent, faas, proxy) with corresponding endpoint services
* These custom service classes in the `repos/backend/src/services/endpoints` directory each extend the `BaseEndpoint` service.
* The services classes are reused in multiple places, mainly in `repos/backend/src/endpoints`, but potentially other places too.
* Each depends on the database, passed in as `db` to the `execute` function
* The `AgentEndpoint` service also has a number of other functions that requires passing in the `db`
* To reduce complexity, instead we should add a constructor function to the `BaseEndpoint`
  * It would accept the `db` instance, and store it on the class instance
  * Update the `execute` and other functions as needed to use `this.db` instead of passing it in as an argument
  * Update all call sites to pass in the `db` on initialization, and remove it from the service function calls

### Open AI Chat completions

  * Need to investigate `repos/backend/src/endpoints/agent/oaiChatCompletions.ts`
  * Currently it checks if the body has messages (i.e. message history)
  * If it does, first it will:
    * Create a new thread
    * Then, create new messages in the database tied to the new thread (i.e. seed thread)
    * This works, but requires recreating new threads and messages on every request
  * This logic should continue to exist, but the code should be updated to:
    * Check if a `threadId` is passed via the `req.body` || `header` and reuse it
      * This and allow threads and their messages to be reused
      * This would allow the backend to keep track of the messages
      * The entire message history would not need to be sent on every request
      * Only the new message would need to be sent
  * Would also need to update the repos/integration tests to validate the functionality, and ensure no regressions.


## Domain

### Parser

* The parser events should types should use an enum following existing repository patterns for enums
  * Then all places where a string is used to reference a parser event type should be updated to use the `EParserEvtType` enum instead of a string
* The `TToolState` should also be an enum and not strings, and all locations that reference it should be updated to use the enum instead of a string
* 

## Admin UI

### Create/Edit Sandbox Drawer

* Needs to be cleaned up and simplified. Options are not well organized or separated properly. Some options are in an Accordion, while others are just displayed directly. No consistency and no organization makes for a bad user experience.


## Threads

* The Admin app has a main header across the top of the app that is always displayed
  * It contains a number of items that should always be visually present
  * On the left side it has:
    * Threaded Stack text and logo
    * Breadcrumb like interface for selecting orgs, and projects
  * On the right side it has:
    * Theme toggle action (completly missing in Threads app)
    * Clickable User Avatar, with dropdown menu containing user specific menu items
  * This component should be copied into the Threads app, and work the same way, with the same functionality.
* The top header bottom border in the main view, does not align with the header bottom border of the sidebar
* No separation between where the sidebar ends and the main window begins visually. Need to update to a clean and visually appealing separation between sidebar and main window.


## Multi-Repo

### Sandboxes

* Users should be able to create multiple connections to the same sandbox. Currently it's only one connection per-sandbox, which means I can only run one claude-code session in that sandbox. But as a user, I should be able to run multiple seperate session.

