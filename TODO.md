# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.


## Admin

* **Project Endpoints Table**
  * The endpoints table that lists all endpoints for a project is missing the table footer
    * So both the Rows per page, and table page navigation are never displayed
  * All other tables include a table footer with Rows per page, and table page navigation sections. Use these as the the guide for adding the table footer to the endpoints table.

* **Project Api Keys**
  * Creating an Api key for a project should allow selecting a user for the API key
  * The user select already exists for Org Api keys Drawer, but not for Project API keys drawer
  * We should be able to create API keys for a specific project and User
    * The user should then be able to use that Api key for only that project, but no others
    * This must be validated and ensure it's working as expected and within these constraints

* **Project Members**
  * The members list does shows `Unknown` instead of the members name


## Backend

* **OpenAI Streaming Support**
  * Users can create AI Agents and tie them to custom endpoints, which allows them to interact with the AI agent via a REST API. It uses SSE to allow streaming the responses from the endpoint
  * OpenAI has release an NPM package (`openai`) that has become a standard for interacting with AI endpoints using SSE.
  * Many other AI products support using the `openai` npm package with their REST api backend.
  * Threaded Stack should do the same. It should allow users to create custom Agent Endpoints via the admin UI. Then they should be able to use the `openai` npm package to interact with it, much like many other popular AI frameworks. 
  * This task is to add that functionality to the custom AI Agent endpoints.