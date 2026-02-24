# Agent Endpoint — Full Overrides Design

**Date**: 2026-02-23
**Task**: [P3] Agent type endpoint — expose all AgentDrawer options to Agent Overrides
**Status**: Approved

## Problem

The `EndpointAgent` component has limited overrides — only system prompt, model, max tokens, and tools. Missing: custom function tools, exposed secrets selector, and agent ID is a raw text input instead of a searchable selector.

## Solution

Cross-repo changes (domain, backend, admin, integration) to add `functionIds` to the endpoint overrides type, update the backend to merge override function IDs with project config, and enhance the admin UI with FunctionsSelector, SecretsSelector, and agent Autocomplete.

ProviderSelector is deferred — requires deeper backend provider routing changes.

## Changes

### Domain (`repos/domain`)
- `types/epd.types.ts` — Add `functionIds?: string[]` to `TAgentEndpointConfig.overrides`

### Backend (`repos/backend`)
- `services/endpoints/agentEndpoint.ts` — Merge `overrides.functionIds` with `projectConfig.functionIds` (deduplicated)

### Admin (`repos/admin`)

**Form state:**
- `types/endpoints.types.ts` — Add `functionIds: string[]` to `TAgentFormState`
- `constants/endpoints.ts` — Add `functionIds: []` to `DefAgentState`

**Mappers:**
- `utils/endpoints/mappers.ts` — Read/write `functionIds` in agent init/map functions

**Components:**
- `types/endpoints.types.ts` — Add `orgId: string` to `TEndpointFormProps`
- `components/Endpoints/EndpointDrawer.tsx` — Pass `orgId` and `availableFunctions` to `EndpointAgent`
- `components/Endpoints/Agent/EndpointAgent.tsx` — Load agents from API, pass to `AgentInputs`
- `components/Endpoints/Agent/AgentInputs.tsx` — Add FunctionsSelector, SecretsSelector, wire functionIds/availableFunctions props

### Integration (`repos/integration`)
- New test validating agent endpoint creation with functionIds in overrides

## Data Flow

```
EndpointDrawer (orgId, projectId, availableSecrets, availableFunctions)
  └── EndpointAgent (receives orgId, loads agents list)
        └── AgentInputs
              ├── Agent Autocomplete (agents from API)
              ├── Agent Overrides Accordion
              │     ├── System Prompt
              │     ├── Model
              │     ├── Max Tokens
              │     ├── ToolsSelector
              │     └── FunctionsSelector (NEW)
              └── Agent Environment Accordion
                    ├── Envs (envVars only)
                    └── SecretsSelector (NEW)
```

## Deferred

- ProviderSelector — requires backend provider routing changes (separate task)
