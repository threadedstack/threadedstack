# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into seperate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.


## Admin

* Org Agents Drawer
  * **Model Configuration**
    * `Model` should not be a Text input, it should be a select dropdown that allows selecting from a list of models for the priority AI provider
  * **AI Providers**
    * Multiple providers can be attached to an Agent, but only one model input is displayed
    * There's no way to set the model used for other providers attached to the agent.
      * Need to investigate and come up with a solution?
  * **Associated Secrets**
    * Secrets Selector throwing errors when clicking on the secret select input


