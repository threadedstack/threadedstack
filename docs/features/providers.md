# Providers

## What Are Providers

Providers are configurations for external AI model services or API services. They store the connection details and credentials needed to call these services on behalf of your agents and sandboxes. Providers are scoped to an organization and shared across all agents and projects within that org.

Each provider has a **brand** (the service it connects to), a **type** (such as `ai` for AI model providers), and a linked **secret** containing the API key or authentication credentials.

## Supported Provider Brands

| Brand | Description |
|-------|-------------|
| Anthropic | Claude models (Claude 4, Claude 4.5, etc.) |
| OpenAI | GPT and o-series models (GPT-4o, o3, etc.) |
| Google | Gemini models (Gemini 2.5 Pro, Flash, etc.) |
| Google Vertex | Google Cloud Vertex AI endpoint |
| Amazon Bedrock | AWS Bedrock-hosted models |
| Azure OpenAI | Azure-hosted OpenAI models |
| Groq | Fast inference for open-source models |
| xAI | Grok models |
| Mistral | Mistral models (Mistral Large, Medium, etc.) |
| OpenRouter | Multi-provider routing gateway |
| Ollama | Self-hosted open-source models |
| Z.AI | Z.AI models |
| Custom | Any OpenAI-compatible API endpoint |

Additional brands (Cerebras, MiniMax, HuggingFace, Kimi Coding, Vercel AI Gateway, and others) are available in the provider creation form. The **Custom** brand allows you to connect to any service that implements the OpenAI chat completions API format.

## Creating a Provider

From the Admin UI:

1. Navigate to **Providers** in the org sidebar.
2. Click **Create Provider**.
3. Select the **Type** (`AI`).
4. Select a **Brand** from the dropdown (e.g., Anthropic, OpenAI).
5. Enter a **name** for the provider.
6. Link a **Secret** containing the API key. You can select an existing secret or create one inline.
7. Optionally add custom **headers** or **body parameters** for requests sent to this provider.
8. Click **Save**.

Once created, the provider is available to all agents and sandboxes in the organization.

## Linking Providers to Agents

Agents connect to providers through a priority-based linking system:

- Each agent can be linked to one or more providers.
- Each link has a **priority** value. Priority `0` is the primary provider, used by default for all LLM requests.
- Each agent-provider link can **override the model** -- for example, linking an Anthropic provider but specifying `claude-sonnet-4-20250514` instead of the provider's default model.
- Multiple providers enable **failover**: if the primary provider returns an error, the agent can fall back to the next provider in priority order.

To link a provider to an agent, open the agent's configuration in the Admin UI and use the **Providers** section to add and prioritize providers.

## Linking Providers to Sandboxes

Sandbox configurations can be linked to providers for credential injection:

- When a provider is linked to a sandbox, its API key is injected into the sandbox environment as a **placeholder token** (a `tdsk_ph_*` prefixed string).
- The sandbox code uses this placeholder token in API requests as if it were a real key.
- The platform's **egress proxy** intercepts all outbound traffic from the sandbox and replaces the placeholder with the real API key before forwarding the request to the external service.

This means the real API key **never enters the sandbox environment**. The credential substitution happens at the network boundary, ensuring that code running inside the sandbox cannot access or exfiltrate the actual secret.

## Secret Templates in Provider Config

Provider headers and body parameters support a template syntax for injecting secret values at request time:

**Syntax:** `{{ secret-name:secretId }}`

Templates are resolved server-side when the backend constructs an outbound request to the provider. The secret is loaded, decrypted, and substituted into the configured value.

**Example header configuration:**

```
Authorization: Bearer {{ my-api-key:xK9mN2pQ4r }}
```

At request time, this resolves to:

```
Authorization: Bearer sk-actual-key-value...
```

If the referenced secret is rotated, all providers using that secret template automatically pick up the new value on the next request -- no configuration changes needed.

## Listing Available Models

You can query the available models for any supported brand. This is useful for populating model selection dropdowns or validating model names before configuring an agent.

The models endpoint returns the list of models that the brand currently supports, including model IDs and display names.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_/orgs/:orgId/providers` | List all providers in the org |
| `POST` | `/_/orgs/:orgId/providers` | Create a new provider |
| `GET` | `/_/orgs/:orgId/providers/:id` | Get a single provider |
| `PUT` | `/_/orgs/:orgId/providers/:id` | Update a provider |
| `DELETE` | `/_/orgs/:orgId/providers/:id` | Delete a provider |
| `POST` | `/_/providers/:brand/models` | List available models for a brand |

All provider endpoints (except the models endpoint) require org membership. Creating, updating, and deleting providers requires `admin` role or higher. Members with `member` role and above can read providers.
