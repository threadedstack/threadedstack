# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.


## Backend

#### `resolveAgentConfig.ts` — Agent Starts Pod Without State Verification

**File**: `repos/backend/src/utils/agent/resolveAgentConfig.ts` (lines 116-124)

**Problem**: When the agent runner starts a sandbox pod, it immediately uses the pod name without waiting for the pod to reach `Running`. With a scheduling failure, the agent tries to execute commands against a non-running pod.

**Impact**: The error surfaces from the exec/sandbox operation rather than from pod startup, making root cause diagnosis harder. The user sees something like "failed to exec in pod" rather than "pod failed to start because RuntimeClass not found."

**Possible fix**: Add a wait-for-Running loop (similar to `connectSandbox.ts`) before returning the pod to the agent runner.

#### `connectSandbox.ts` — Generic Timeout with No Root-Cause Logging

**File**: `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` (lines 52-97)

**Problem**: The polling loop checks for `Failed` and `Terminating` states but does not inspect pod conditions during prolonged `Pending`. When a pod is stuck (e.g., nonexistent RuntimeClass), the user waits the full 120 seconds and gets a generic 504: "Pod did not reach Running state within timeout." Backend logs show the same generic message with no detail about *why* the pod is stuck.

**Impact**: Operators debugging a production issue must manually `kubectl describe pod` to discover the root cause. If the RuntimeClass is misconfigured, every pod creation fails with the same opaque 2-minute timeout.

**Possible fix**: During the polling loop, when state is `Pending` for more than ~30 seconds, fetch the pod's `status.conditions` and log them. K8s includes messages like `"RuntimeClass 'kata-clhh' not found"` in conditions that would immediately identify the problem. Optionally include condition messages in the 504 error response.



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

* Setup wizard is very broken
* Hide domains in navigation behind a feature flag
* Add a warning when an AI provider is added to a sandbox and it doesn't have an auth secret and allow the user to select/add one from the same UI



## Sandbox

* When building the sandbox docker image, I see the following error:
  ```
  # Warning: Ignoring extra certs from `/usr/local/share/ca-certificates/tdsk-proxy.crt`, load failed: error:80000002:system library::No such file or directory
  ```
  * Is this an issue? Something that we should be concerned about? How do we fix it?


## TSA

* `sshConfig.ts`
  * The ensureProxyWrapper function is brittle. Need to find a way to improve it
  * tsa ssh uses a key instead of a password. The key gets injected into the container
    * Investigate better ways to handle this
* Calling tsa commands with a session id, but no instance id
  * Should auto-resolve the instance id with these steps
    * It could use an existing endpoint, or create a new endpoint in backend
    * Get a list of all running instances and their current session
    * Loop through each and find a matching session id
    * On found match return instance id
    * **IMPORTANT** - Requires session ids to be unique across all running org instances
      * If two instances have sessions with the same id, then this process will break
      * Need to investigate if that's possible
      * May need to update how instances and session ids are genreated to ensure they are unique


## Database

* Add passwords to seed users so we can authenticate with them
* 

## Multi-Repo
