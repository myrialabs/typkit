# Claude Code Guidelines

Guidelines for Claude Code when working on **TypKit**.

---

## What This Project Is

TypKit is a TypeScript schema-validation library for Node 18+, Bun, and the
browser. A schema is built with the `t` builder, either by chaining constraints
(`t.int().min(1).max(5)`, the documented primary style) or with an equivalent
config object (`t.int({ min: 1, max: 5 })`). Chaining is build-time only: each
method accumulates options onto a node, so both forms compile to the **identical**
validator. On first use the whole tree is compiled — once — into a single
monomorphic function via `new Function`, then cached on the schema.

- `check` / `assert` / `parse` for validation, `['~standard']` for Standard Schema,
  `toJsonSchema()` for JSON Schema, and `t.infer<>` for type inference.
- Framework helpers live in `src/middleware/` (`@myrialabs/typkit/middleware`).

The package ships ESM (`NodeNext`) from `src/` to `dist/`, exports the API from
`src/index.ts`, and the middleware from `src/middleware/index.ts`. There is no
build engine and no runtime dependency.

---

## Non-Negotiables

- **Zero happy-path allocation.** A compiled validator returns `0` on success — no
  wrapper object. Error records and issue paths are built only on the failure
  branch. A change that allocates on the success path is a regression.
- **Inline constraints, no closures in built-ins.** Every built-in rule
  (`maxLines`, `charset`, `blockWords`, formats, ranges, …) must emit literal
  expressions/loops. The only closure path is `t.refine`, and it is documented as
  the slow path. Don't add a built-in that compiles to a closure.
- **`finite` is opt-in.** `t.number()` does not reject `NaN`/`Infinity` by default
  (JSON-safe). Don't add the guard back to the default path.
- **Discriminated unions dispatch O(1)** via a `switch` on the tag — never by
  trying members in sequence.
- **Standard Schema + JSON Schema both stay correct.** They are the interop
  surface; changes to nodes must keep `['~standard']` and `toJsonSchema()` in sync.
- **Cross-runtime.** `src/` runs on Node 18+, Bun, and the browser. No required
  runtime dependency; the Standard Schema type is vendored, not depended on.
- **Quiet core.** No `console.*` in the library. Strict TypeScript and ESLint stay
  on — don't loosen them to make a change pass.
- Don't overwrite unrelated user changes — check `git status` first.

---

## Current Architecture

- `src/index.ts` — public barrel.
- `src/typkit.ts` — the `t` builder (every factory) and the `t.infer` namespace.
- `src/compiler.ts` — the `Emitter` (codegen) and the lazily-compiled `TypeNode`
  base that supplies `check`/`assert`/`parse`/`~standard`/`toJsonSchema` plus the
  chain modifiers (`optional`/`nullable`/`default`/`refine`/`array`). It also holds
  the `reg` registry: node modules inject their wrapper constructors into it so the
  base class can build them without importing `nodes/` (keeps the module cycle-free).
  The internal "property may be absent" flag is `isOptional` (not `optional`, which
  is the chain method).
- `src/nodes/` — node classes: `scalars.ts`, `object.ts`, `array.ts` (array/tuple/
  record), `union.ts` (union/discriminated/intersection), `modifiers.ts` (optional/
  nullable/default/lazy/refine).
- `src/constraints/` — inline constraint emitters for string / number / array.
- `src/formats.ts` — precompiled format regexes.
- `src/coerce.ts` — coercion nodes (number/boolean/date) for query params.
- `src/json-schema.ts` — the `JsonSchema` type.
- `src/standard-schema.ts` — vendored `StandardSchemaV1`.
- `src/errors.ts` — `Issue`, `TypkitError`, path formatting.
- `src/infer.ts` — type-level inference helpers.
- `src/middleware/` — `elysia.ts`, `hono.ts`, `trpc.ts`, `shared.ts`, `index.ts`.
- `docs/`, `examples/`, `bench.ts`, `bench-results.md`.

---

## Work Protocol

### Before Editing
- Read the relevant node and its colocated test. Use `rg` for search.
- For a constraint change, read `src/constraints/` and the matching node.

### While Editing
- Match local style: tabs, single quotes, semicolons, `const` by default.
- kebab-case files; `camelCase`/`PascalCase`/`UPPER_SNAKE_CASE` identifiers.
- ESM with explicit `.js` import specifiers (NodeNext).
- Keep `any` to the codegen/runtime boundary (emitted source is untyped JS;
  middleware contexts are opaque).
- Add `bun:test` next to non-trivial logic. A constraint change needs a test that
  checks both behavior (valid/invalid) **and** the issue path / codegen result.

### After Editing
```sh
bun run typecheck
bun run lint
bun run test
bun run build
```
For docs-only changes, say so and skip the code checks.

---

## Public Surface Rules

- Public API changes → update `README.md` and `docs/`.
- New node or constraint → keep `emit`, `jsonSchema`, and (if relevant) `transform`
  consistent, and update `docs/constraints.md` or `docs/api.md`.
- Performance claims → only cite `bench-results.md`, and re-run `bun run bench`.
- Keep repository-facing text in English.

---

## Verification Reference

- `bun run typecheck` — `tsc -p tsconfig.json --noEmit`
- `bun run lint` — ESLint flat config
- `bun run test` — `bun:test` (includes Elysia + Hono integration)
- `bun run build` — emit `dist/`
- `bun run bench` — build, then run the benchmark
