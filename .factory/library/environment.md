# Environment

Environment variables, external dependencies, and setup notes.

## What belongs here

Required env vars, external dependency assumptions, local tooling expectations, and setup notes.

## Local Tooling

- Java 17 must be available.
- The project must use the checked-in Gradle wrapper because system Gradle is not available in this environment.
- Outbound network access is required during setup to resolve Gradle dependencies and Playwright browser binaries.

## External Dependencies

- Maven Central / Gradle Plugin Portal for dependency resolution
- Playwright browser downloads during initial setup

## Runtime Configuration

The framework should expose:

- a shared base-URL configuration input for the sample suite through `E2E_BASE_URL` or `-De2e.baseUrl=...`
- an auth-mode selector through `E2E_AUTH_MODE` or `-De2e.auth.mode=...`
- an OIDC handler selector through `E2E_OIDC_HANDLER` or `-De2e.oidc.handler=...`

Workers should keep configuration centralized so app-specific steps do not hardcode the demo endpoint or auth flow as their only source of truth.

## Notes

- No third-party credentials or live IdP accounts are required for this mission.
- OIDC validation must remain framework-only and rely on repo-local fake/stub behavior.
- Service ports and commands belong in `.factory/services.yaml`, not here.
