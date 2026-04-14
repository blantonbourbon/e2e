# Core Runtime Configuration

The `core` module now exposes a shared runtime configuration surface in `com.example.e2e.core.config`.

## Public contract

- `RuntimeConfiguration.load()` reads live process inputs
- `RuntimeConfiguration.load(ConfigurationSource)` supports tests and future callers that need explicit inputs
- Base URL keys:
  - system property: `e2e.baseUrl`
  - environment variable: `E2E_BASE_URL`
- Auth mode keys:
  - system property: `e2e.auth.mode`
  - environment variable: `E2E_AUTH_MODE`
- OIDC handler keys:
  - system property: `e2e.oidc.handler`
  - environment variable: `E2E_OIDC_HANDLER`

## Current validation rules

- Base URL is always required and must be an absolute `http` or `https` URL.
- System properties take precedence over environment variables.
- Default auth mode is `baseline` when no auth-mode input is provided.
- Supported auth modes: `baseline`, `oidc`
- Supported OIDC handler names: `saved-session`, `api-token`
- OIDC mode fails fast unless a supported handler is configured.

## Boundaries

- `core` currently contains only framework metadata plus config types/tests; no app-specific runners, selectors, or feature resources were added here.
