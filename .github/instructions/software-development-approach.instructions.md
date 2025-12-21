---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

## Best Practices
- **SOLID principles:** Follow single responsibility, open/closed, Liskov substitution, interface segregation, and dependency inversion to keep code maintainable and extensible.
- **Clean Architecture:** Separate concerns (domain, application, infrastructure, UI). Keep business logic framework- and delivery-agnostic so it is easy to test and evolve.
- **TDD (Test-Driven Development):** Prefer writing failing tests first, implement minimal code to pass tests, then refactor. Ensure new functionality is covered by unit and integration tests.
- **Testing strategy:** Unit tests for business logic, integration tests for module interactions, and end-to-end tests for critical user flows; use mocks/stubs for external dependencies.
- **Quality tools:** Use TypeScript types, ESLint, Prettier, and automated CI checks to enforce style and catch issues early.
- **Build & Test:** Ensure the build and all tests pass locally and in CI for every change; update CI configuration as needed and block merges on failing checks.
- **PR reviews and commits:** Keep pull requests small and focused, write descriptive commit messages, and require at least one reviewer before merging.
- **Documentation:** Add or update README, public API docs, and changelogs when introducing or changing behavior.
- **Security & Performance:** Consider basic security practices (input validation, secrets management) and measure performance for critical paths.
- **TypeScript & Full-stack alignment:** Prefer explicit typings, shared models, and layered services/controllers so that frontend and backend stay consistent and testable.

## Guidance for AI
- When generating code, prefer small, pure, testable modules and include tests along with implementation.
- Run the test suite and ensure the project builds successfully after making changes; if tests or the build fail, fix them or add/update tests and CI.
- When proposing architectural changes, include migration steps, rationale, and tests.
- If adding or modifying behavior, update tests and documentation in the same change whenever possible.
- Keep guidance concise, actionable, and aligned with existing project conventions.

## Full-stack TypeScript, Security, and KISS Guidance
- Treat new features as full-stack efforts: define DTOs/responses once, reuse them via shared modules or codegen, and keep UI components, hooks, services, and middleware in sync through those contracts.
- Validate and sanitize every trust boundary before it hits business logic; keep secrets in env/config, rotate keys, and avoid bundling credentials into client code.
- Ship the simplest working solution that satisfies acceptance criteria, instrument happy/unhappy flows, and document future improvements (e.g., “future: swap cache for tenant-aware queue”) so the next iteration can safely extend behavior.
