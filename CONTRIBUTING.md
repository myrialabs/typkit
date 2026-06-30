# Contributing Guide

Thanks for considering a contribution to **TypKit**. This guide covers the dev
setup, conventions, and the submission process.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.2+ (used for dev, tests, and CI).

TypKit ships as a TypeScript ESM library with **no runtime dependency**, running
on **Node 18+, Bun, and the browser**. Use `bun` for all package management and
scripts.

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/typkit.git
cd typkit
git remote add upstream https://github.com/myrialabs/typkit.git
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

All of these should pass on a fresh clone.

---

## Development Workflow

```bash
git checkout main && git pull upstream main
git checkout -b feature/your-feature
# develop & verify:
bun run typecheck && bun run lint && bun run test && bun run build
git commit -m "feat(constraints): add isbn format"
git push origin feature/your-feature   # then open a PR targeting main
```

---

## Project Principles

Non-negotiable — a PR that breaks one needs explicit discussion first:

- **Zero happy-path allocation.** Compiled validators return `0` on success;
  error records and issue paths are built only on the failure branch.
- **Inline constraints, no closures in built-ins.** Every built-in rule compiles
  to literal expressions/loops. `t.refine` is the only closure path, documented as
  the slow path.
- **`finite` stays opt-in.** `t.number()` is JSON-safe and does not reject
  `NaN`/`Infinity` by default.
- **O(1) discriminated unions.** Dispatch on the tag via a `switch`.
- **Standard Schema + JSON Schema stay correct.** Every node keeps `['~standard']`
  and `toJsonSchema()` in sync.
- **Cross-runtime, zero-dependency.** `src/` runs on Node 18+, Bun, and the
  browser; the Standard Schema type is vendored, not depended on.
- **Quiet core.** The library never writes to stdout/stderr.
- **Public API changes are documented.** Update `README.md` and the relevant
  `docs/*.md` in the same PR.

---

## Code Style

- TypeScript, strict mode. `const` by default; `let` only when reassigned.
- ESM with explicit `.js` import specifiers (required by `NodeNext`).
- Tabs, single quotes, semicolons. No Prettier — manual consistency.
- Naming: `camelCase` values, `PascalCase` types/classes, `UPPER_SNAKE_CASE`
  constants, `kebab-case` files.
- `any` is acceptable only at the codegen/runtime boundary (emitted validator
  source is untyped JS; framework middleware contexts are opaque).

### Tests

Add a `*.test.ts` next to the source using `bun:test` for any non-trivial logic
where a regression would be silent. A change to a constraint or node needs a test
that asserts **both** the validation behavior (valid/invalid inputs) **and** the
resulting issue path — codegen bugs hide in the path, not just the boolean.

```bash
bun test src/constraints.test.ts   # single file
bun test                           # full suite
```

Framework integrations have live tests (`src/middleware/*.test.ts`) that start an
app and fire a request; keep them green.

---

## Submitting Changes

All repository-facing text — branch names, commit messages, PR titles and
descriptions, PR comments — must be in **English**.

### Branch Naming

`<type>/<description>` — lowercase, kebab-case, exactly one `/`.
Types: `feature/`, `fix/`, `docs/`, `chore/`.

### Commit Messages

`<type>(<scope>): <subject>` — imperative, lowercase, no period, ≤72 chars.
Types: `feat`, `fix`, `docs`, `chore`, `release`.
Common scopes: `compiler`, `nodes`, `constraints`, `coerce`, `json-schema`,
`standard-schema`, `middleware`, `readme`, `examples`, `bench`.

```
feat(constraints): add allowedWords for strings
fix(union): dispatch discriminated unions in O(1)
docs(frameworks): document the Hono validator
```

### Pre-commit Checklist

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run build` emits `dist/` cleanly
- [ ] New constraint/node has a behavior **and** path test
- [ ] Public API change reflected in `README.md` + `docs/`
- [ ] Performance claim re-measured via `bun run bench`

### Pull Request Description Template

```markdown
## Summary
What this PR does, in a sentence or two.

## Why
The motivation — bug it fixes, behavior it changes.

## Changes
- concrete bullet list

## Notes (optional)
Trade-offs, follow-ups.
```

Add `## Breaking changes` with a migration note whenever the public API changes.

---

## Reference

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # eslint
bun run test          # bun:test
bun run build         # emit dist/
bun run bench         # build, then benchmark
```

- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Bun Docs](https://bun.sh/docs)
- [Standard Schema](https://standardschema.dev)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Questions?

- [Issues](https://github.com/myrialabs/typkit/issues)
