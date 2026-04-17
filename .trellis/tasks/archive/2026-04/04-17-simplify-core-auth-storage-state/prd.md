# Simplify core auth to storage-state model

## Goal

Simplify the `core` module auth/runtime design so it follows Playwright Java's storage-state-first authentication model instead of the current OIDC handler registry abstraction.

## Requirements

- Replace the OIDC handler-based runtime auth bootstrap with a smaller authenticated-state configuration model.
- Keep baseline execution working when no authenticated state is configured.
- Support Playwright storage-state reuse as the primary authentication mechanism.
- Support session-storage seeding only as a narrow exception path.
- Keep the runtime API and tests coherent after the simplification.
- Remove dead abstractions that are no longer needed.

## Acceptance Criteria

- [ ] `PlaywrightRuntime` can start a baseline context with no auth state configured.
- [ ] `PlaywrightRuntime` can start a context from configured storage-state input.
- [ ] Optional session-storage seeding is applied before page creation when configured.
- [ ] OIDC registry/handler/supplier abstractions are removed from the default flow.
- [ ] Core tests cover the simplified configuration and runtime behavior.

## Technical Notes

- Align with Playwright Java auth guidance centered on saved browser state.
- Prefer typed configuration over ad hoc environment reads.
- Keep error messages fail-fast and explicit.
