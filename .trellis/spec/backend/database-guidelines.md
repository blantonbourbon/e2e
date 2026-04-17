# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

This project does not currently contain a database layer, ORM, migration tool, or direct persistence client. That is intentional.

For this E2E framework:

- the application under test owns its database
- the test framework should prefer public APIs, seeded environments, or auth/bootstrap helpers
- direct database access is the exception, not the default

If a future scenario absolutely requires database access, treat it as infrastructure code with a very narrow surface area. Do not let SQL or schema knowledge leak into step definitions or page objects.

---

## Query Patterns

Current rule:

- No production or test module should talk to a database unless the team explicitly accepts that coupling.

If direct data access becomes unavoidable:

- Put data-access helpers in a dedicated support package, not in step-definition classes.
- Prefer read-only verification helpers over write helpers.
- Use parameterized queries only. Never build SQL by string concatenation from scenario input.
- Return typed records or DTOs, not raw maps unless the database response is truly dynamic.
- Keep each helper focused on one aggregate or fixture concern.
- Close resources deterministically and keep connection ownership explicit.
- Log only sanitized metadata, never credentials, tokens, or result sets containing sensitive data.

Preferred alternatives before touching a database:

- Seed state through the product's public API.
- Reuse environment fixtures or test accounts.
- Reuse Playwright storage-state files or other test-environment fixtures already prepared for the suite.
- Assert user-visible behavior first; only use DB checks for setup/cleanup or unavoidable back-office verification.

---

## Migrations

This repository does not own schema migrations.

- Do not add Flyway, Liquibase, Hibernate DDL, or ad hoc migration scripts to this repo without a deliberate architecture decision.
- Schema evolution belongs in the application-under-test repository or in environment provisioning automation.
- If tests depend on seeded data, version that seed process in the owning system, not here.
- If a local ephemeral database is ever added for test fixtures, its lifecycle must be isolated to development/test tooling and kept out of the shared runtime path.

---

## Naming Conventions

Because this framework avoids direct persistence, the primary naming conventions here are configuration-facing:

- Environment variables use uppercase `E2E_*` names.
- JVM properties use lowercase dotted `e2e.*` names.
- If a database helper is introduced, name helpers after business intent, not raw table names.
- Avoid baking table, schema, or index names into feature files or step text.
- Keep any unavoidable SQL close to the support helper that owns it; do not duplicate the same table names across multiple glue classes.

---

## Common Mistakes

- Using database writes to bypass the user journey the scenario is supposed to validate.
- Asserting internal rows when a user-visible assertion would be more stable and meaningful.
- Spreading schema knowledge across step definitions, hooks, and page objects.
- Logging connection strings, access tokens, session blobs, or raw result payloads.
- Treating a temporary DB helper as "just test code" and skipping cleanup, typing, or review discipline.

## Examples

Current repo evidence that persistence is intentionally absent:

- No database module is declared in `settings.gradle`.
- Shared framework dependencies in `core/build.gradle` include Playwright and Allure, not ORM or JDBC tooling.
- Runtime configuration resolves only system properties and environment variables in `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java` and `core/src/main/java/com/example/e2e/core/config/ConfigurationSource.java`.
- Auth/test bootstrap currently relies on Playwright storage-state reuse rather than persistence clients:
  - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

## External References

- Cucumber-JVM installation and dependency guidance: https://cucumber.io/docs/installation/java/
