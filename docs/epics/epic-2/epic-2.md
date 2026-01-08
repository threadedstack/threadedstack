# Phase 2: Backend Proxy Feature

**Goal:** Implement a production-ready Reverse Proxy with Secret Injection, Body Transformation, and Machine-to-Machine Authentication.

## 1. Backend API & Data

* **Secrets Management:**
* Implement `POST /_/secrets`.
* Ensure all values are encrypted before insertion (store `encrypted_value`).
* Associate secrets with specific Teams or Repositories.

* **Endpoint Management:**
* Implement `POST /_/endpoints` to create proxy definitions.
* Define schema for `proxy_url`, `proxy_headers`, and `proxy_options` (for regex/replacements).


## 2. Proxy Engine Logic (`/proxy/*`)

* Implemented in the `/repos/backend` sub-repo.
* **Lookup:** Match the incoming request path to a defined Endpoint.
* **Decryption:** Fetch and decrypt the required Secrets associated with the Endpoint.
* **Header Injection:** Merge defined `proxy_headers` with the decrypted Secrets (e.g., injecting `Authorization` headers).
* **Body Transformation:** Apply Regex/Replacement rules defined in `proxy_options` to the request body.
* **Execution:** Stream the modified request to the target `proxy_url` and stream the response back to the client.

## 3. Security & Auth Layer

* **OAuth Client Credentials:** Implement flow for Machine-to-Machine authentication within the Proxy.
* **API Keys:** Implement logic for API Key generation and validation.
* **Domain Whitelisting:** Implement logic to restrict proxy targets to approved domains.

## 4. Frontend / Admin UI

* **Secrets Manager:**
* Forms to Create/Edit/List secrets.
* Integrate lists into Team/Repo views.


* **Endpoint Builder:**
* UI to define the target `proxy_url`.
* Interface to add Headers (referencing stored secrets).
* Interface to configure `proxy_options` (regex rules).


## Deliverables / Acceptance Criteria

* User can create an Endpoint and attach a Secret via UI.
* Proxy successfully validates API Key/OAuth.
* Proxy injects headers, performs body transforms (if applicable), and streams the response from the target URL.