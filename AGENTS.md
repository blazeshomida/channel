# Agent Instructions

## Project Overview

This repository follows Blaze's engineering handbook for reusable coding, documentation, workflow, and release standards.

Use this file for repository-specific instructions. Use the handbook as the canonical source for reusable standards unless this repository explicitly overrides them.

This repository is the workspace for `@blazeshomida/channel`, a typed message channel package for workers and other transports. The package is currently private while the API is being explored.

## Handbook References

Primary handbook:

- Handbook: https://github.com/blazeshomida/handbook
- Standards: https://github.com/blazeshomida/handbook/tree/main/standards
- Templates: https://github.com/blazeshomida/handbook/tree/main/templates

Use the most relevant standard before making broad changes:

- TypeScript: https://github.com/blazeshomida/handbook/blob/main/standards/code/typescript.md
- JavaScript: https://github.com/blazeshomida/handbook/blob/main/standards/code/javascript.md
- Code documentation: https://github.com/blazeshomida/handbook/blob/main/standards/code/documentation.md
- Tooling: https://github.com/blazeshomida/handbook/blob/main/standards/tooling.md
- Commits: https://github.com/blazeshomida/handbook/blob/main/standards/workflow/commits.md
- Pull requests: https://github.com/blazeshomida/handbook/blob/main/standards/workflow/pull-requests.md
- Changesets: https://github.com/blazeshomida/handbook/blob/main/standards/workflow/changesets.md
- Releases: https://github.com/blazeshomida/handbook/blob/main/standards/workflow/releases.md

If internet access is unavailable, follow the critical rules in this file.

## Workspace

```txt
packages/
  channel/

playgrounds/
  vanilla/
  vanilla-workers/

tooling/
.github/
.changeset/
```

## Workspace Boundaries

- Root config owns workspace-wide tooling and task orchestration.
- Package config owns package build, test, and publish behavior.
- Playground config owns browser/demo behavior.
- `tooling/` owns shared Vite+ format, lint, task, and pattern config.
- `.github/` owns CI, release, PR, and issue templates.
- `.changeset/` owns versioning and release intent.

Do not move package-specific behavior into root config unless it truly applies to the whole workspace.

## File and Folder Conventions

Prefer vertical structure over horizontal structure.

Use the vertical codebase approach as the default reference: https://tkdodo.eu/blog/the-vertical-codebase

Group code by feature, domain, package concern, or workflow instead of by technical file type. Code that changes together should usually live together.

Rules:

- `index.ts` is the public boundary for a vertical.
- `_*.ts` files are private to the vertical.
- `_*/` folders are private implementation folders.
- Do not import from another vertical's `_` files.
- Promote code to shared only after at least two real call sites need it.
- Shared code should have a clear name and ownership; avoid vague names like `utils`.
- Keep tests near the code they verify when practical.
- Keep types near the code that owns them unless they are part of the public API.

## Worktree Convention

Use sibling worktree directories for parallel branch work.

Convention:

```txt
{repo}.worktrees/{slugified-branch}
```

Example:

```txt
channel/
channel.worktrees/refactor-peer-internals
channel.worktrees/docs-readme-updates
```

Rules:

- Keep the main checkout at the repo root.
- Keep branch worktrees in the sibling `.worktrees` directory.
- Slugify branch names by replacing `/` with `-`.
- Do not create nested worktrees inside the main checkout.
- Verify the active worktree before editing, committing, rebasing, or force-pushing.

## Repository Commands

Prefer the package manager already used by the repository. This repository uses `pnpm` through Vite+. Do not switch to `npm`, `yarn`, or `bun` unless explicitly requested.

Vite+ runs package scripts and configured tasks through `vp run`. Use `vpr` as the shorthand for human-facing commands.

Install dependencies:

```sh
vp install
```

Run the full verification workflow:

```sh
vpr ready
```

Run workspace checks:

```sh
vpr check
```

Run package tests:

```sh
vpr test
```

Build the vanilla playground:

```sh
vpr build
```

Build the worker playground:

```sh
vpr build:vanilla-workers
```

Build the package:

```sh
vpr pack
```

Run the vanilla playground:

```sh
vpr dev:vanilla
```

Run the worker playground:

```sh
vpr dev:vanilla-workers
```

Run the package build watcher:

```sh
vpr dev:package
```

Create a changeset for user-facing package changes:

```sh
vpr changeset
```

Apply pending changesets locally:

```sh
vpr version
```

Format files:

```sh
vpr fmt
```

Lint files:

```sh
vpr lint
```

## Vite+ Tasks

The workspace uses Vite+ tasks to keep package and playground checks ordered correctly.

Important tasks:

- `task:channel:pack` builds package output and declarations.
- `task:workspace:fmt` formats workspace files and is intentionally uncached.
- `task:workspace:lint` runs workspace linting.
- `task:workspace:check` depends on `task:channel:pack` and runs workspace checks after package declarations exist.
- `task:channel:test` runs package tests.
- `task:vanilla:build` depends on `task:channel:pack` and builds the vanilla playground against package output.
- `task:vanilla-workers:build` depends on `task:channel:pack` and builds the worker playground against package output.
- `task:ready` runs workspace check, package tests, and playground builds.

The playgrounds import `@blazeshomida/channel` through the workspace package name. Keep this package-realistic import path unless explicitly asked to test source aliases.

Each package or playground owns its own `#/* -> ./src/*` alias. Do not define `#/*` in the root `tsconfig.base.json`.

## Workflow

- Inspect the current repo state before changing files.
- Keep edits scoped to the requested task.
- Prefer existing project patterns over new abstractions.
- Do not rewrite existing files unless the requested behavior requires it.
- Do not revert user changes unless explicitly asked.
- Do not introduce unrelated formatting changes.
- Do not rename files, move modules, or change public APIs unless the task requires it.
- Run the smallest reliable check that covers the change.
- Run broader checks when touching shared behavior, public APIs, build config, or release paths.
- If a check is not run, say so and explain why.

## Research Before Implementation

Before implementing a change:

- Read the relevant files first.
- Look for existing patterns in nearby modules.
- Check package scripts before inventing commands.
- Check existing tests before adding new test structure.
- Check public exports before adding or removing exports.
- Prefer repository-local conventions over general advice.

When external behavior depends on a library, framework, or tool, verify the current documentation before making assumptions.

## Package Design

The package should grow in layers:

```txt
Transport
  environment-specific send / subscribe / close adapter

Channel
  typed lifecycle wrapper over a transport

Peer
  request / response, events, streams, errors, and cancellation over a channel

Contract
  shared schemas and inferred types for peer methods, events, and streams
```

Keep the channel layer intentionally small. It should normalize transport lifecycle and message flow, not implement RPC, schemas, events, or streams.

Prefer this conceptual API direction:

```ts
const transport = createTransport(worker);
const channel = createChannel(transport);
const peer = createPeer(channel, contract);
```

Environment-specific transport modules may export the same local name when the import path disambiguates the environment:

```ts
import { createTransport } from "@blazeshomida/channel/worker/client";
```

```ts
import { createTransport } from "@blazeshomida/channel/worker/host";
```

Do not add root exports casually. Public API boundaries should stay explicit and intentional.

## TypeScript Rules

Follow the handbook TypeScript standard.

Critical defaults:

- Prefer TypeScript for application and library code.
- Avoid `any`.
- Do not use `as any`.
- Prefer `unknown` at untrusted boundaries.
- Validate or narrow boundary values before internal use.
- Fix types at the source instead of casting at call sites.
- Keep unsafe casts local, narrow, and justified by nearby runtime checks.
- Prefer `satisfies` for config objects and lookup maps when useful.
- Use type-only imports and exports for type-only dependencies.
- Keep public API types named, readable, and stable.
- Prefer discriminated unions for state and result modeling.
- Prefer explicit return types for exported functions.

## Code Style

Follow existing project style first.

General defaults:

- Prefer small, focused modules.
- Prefer explicit public exports.
- Avoid accidental root exports.
- Prefer functional utilities unless a class is clearly the better model.
- Keep names descriptive and consistent with nearby code.
- Keep examples practical and minimal.
- Avoid clever abstractions that do not reduce real duplication.
- Do not add comments that only repeat what the code says.
- Prefer vertical folders grouped by behavior over horizontal folders grouped by file type.

## Public API Changes

When changing public API behavior:

- Preserve backwards compatibility unless a breaking change is requested.
- Update docs and examples alongside code.
- Add or update tests for user-visible behavior.
- Check export boundaries.
- Mention the API impact in the final response.

For this package, public API changes include:

- changing root exports from `@blazeshomida/channel`
- adding or changing subpath exports
- changing transport, channel, peer, contract, or schema types
- changing runtime behavior for send, subscribe, close, request, emit, or stream flows

## Documentation

Follow the handbook code documentation standard.

Document public API behavior when names and types are not enough, especially:

- constraints
- side effects
- failure modes
- runtime requirements
- non-obvious examples
- compatibility notes

Avoid comments that restate obvious implementation details.

Update README examples when package usage changes.

## Tests And Checks

Run the smallest reliable verification for the change.

Examples:

- Type-only change: run `vpr check`.
- Package behavior change: run `vpr test`.
- Package public API change: run `vpr ready`.
- Build config change: run `vpr ready`.
- Playground change: run `vpr build`, the relevant playground build task, or `vpr ready`.
- Release workflow or package metadata change: run `vpr ready` and inspect package output when relevant.

For package packing changes, verify the tarball shape when useful:

```sh
vpr pack
cd packages/channel
pnpm pack --dry-run
```

If tests do not exist for the touched area, say that clearly and explain what was verified instead.

## Commits

Follow the handbook commit standard.

Before suggesting a commit message:

- Identify the primary change.
- Use the smallest useful scope.
- Use one primary intent.
- Avoid mixing unrelated changes.
- Mention breaking changes only when behavior or API compatibility actually breaks.

Do not create commits unless explicitly asked.

Preferred scopes for this repository include:

- `channel`
- `playgrounds/vanilla`
- `playgrounds/vanilla-workers`
- `ci`
- `release`
- `changesets`
- `github`
- `readme`
- `tsconfig`

## Pull Requests

Follow the handbook pull request standard.

A good PR summary should include:

- what changed
- why it changed
- how it was verified
- risks, tradeoffs, or follow-up work

For UI changes, include screenshots or describe the visual difference.

## Changesets And Releases

Use Changesets for user-facing package changes.

Create a changeset when a change affects package consumers, including:

- new public APIs
- changed public API behavior
- bug fixes in package behavior
- changed package exports
- changed runtime compatibility

Do not create a changeset for internal-only repo maintenance unless it affects the published package.

Publishing is currently disabled while `packages/channel/package.json` has:

```json
"private": true
```

To enable publishing later:

1. Remove `"private": true` from `packages/channel/package.json`.
2. Confirm package metadata is complete.
3. Configure npm trusted publishing for `.github/workflows/release.yml`.
4. Merge a Changesets release pull request.

## Dependency Changes

Before adding a dependency:

- Check whether the repo already has an equivalent utility.
- Prefer small, well-maintained dependencies.
- Avoid adding dependencies for trivial logic.
- Explain why the dependency is needed.
- Update lockfiles consistently.

Do not switch package managers.

## Tooling Rules

Vite+ owns formatting, linting, checking, testing, packing, and task orchestration.

Shared task input patterns live in `tooling/patterns.ts`.

When adding generated files, outputs, or cache directories, update tooling patterns and task outputs as needed.

## Generated Files

Do not manually edit generated files unless the repository explicitly requires it.

Common generated files may include:

- package `dist` output
- declaration output
- playground build output
- coverage output
- Vite+ cache output
- lockfile-only changes from unrelated installs

If generated files need updating, use the repository's generation command.

## Safety And Secrets

- Do not print secrets, tokens, private keys, or credentials.
- Do not commit `.env` files unless the repo intentionally tracks an example file.
- Prefer `.env.example` for documented environment variables.
- Redact sensitive values in logs and responses.

## Final Response

When work is complete, include:

- What changed.
- What was verified.
- Anything not run or not completed.
- Any follow-up required before merge or release.

Keep the response concise and specific to the completed work.
