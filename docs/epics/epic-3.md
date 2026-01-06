# Phase 3: FaaS (Function as a Service)

**Goal:** Secure, serverless execution of custom user code.

## 1. Compute Engine (Backend)

* **Runtime Environment:**
* Integrate a secure WASM runtime.
* **Sandbox Security:** Ensure strict isolation for execution.


* **Execution Logic (`/faas/*`):**
1. **Fetch:** Retrieve Function code and configuration from the `functions` table based on the endpoint.
2. **Inject Context:** Inject `req.body` and user-defined `secrets` into the runtime environment.
3. **Execute:** Run the code within the WASM/Sandbox environment.
4. **Return:** Capture output and return the response to the caller.


## 2. Function Management & UI

* **Code Editor:** Embed Monaco Editor in the Admin UI.
* **Function Configuration:**
* Define language runtime (TS/Python).
* Define dependencies.
* Link to specific Endpoint.


* **Persistence:** Save code, configuration, and metadata to the backend `functions` table.

## 3. Language Support

* **TypeScript/JavaScript:** Support via internal transpiler or QuickJS (TBD).
* **Python:** Support via WASM build (Pyodide or similar).

## 4. Git Integration (Investigation)

* Explore "Git Push" workflows to update Function code automatically (serving as an alternative to UI updates).


## Deliverables / Acceptance Criteria

* User can write a function in the UI (or push via Git), configure its secrets/dependencies, execute it via a public API endpoint, and receive the computed result.

