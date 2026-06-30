<p align="center">
  <img src="https://typkit.myrialabs.dev/favicon.svg" alt="TypKit" width="72" height="72" />
</p>

<h1 align="center">TypKit</h1>

<p align="center">
  <strong>Fast TypeScript schema validation, with the rich constraints other validators can't inline.</strong><br />
  Config-object schemas compiled to one monomorphic function — zero-allocation hot
  path, Standard Schema, and JSON Schema export — for Node, Bun &amp; the browser.
</p>

<p align="center">
  <a href="https://typkit.myrialabs.dev/">Website</a> ·
  <a href="https://www.npmjs.com/package/@myrialabs/typkit">npm</a> ·
  <a href="./docs/api.md">API reference</a> ·
  <a href="./docs/constraints.md">Constraints</a> ·
  <a href="./examples/README.md">Examples</a> ·
  <a href="https://github.com/myrialabs/typkit/issues">Issues</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@myrialabs/typkit"><img src="https://img.shields.io/npm/v/@myrialabs/typkit" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/runtime-Node%2018%2B%20%7C%20Bun%20%7C%20Browser-black" alt="Node 18+, Bun and Browser" />
</p>

---

TypKit is a TypeScript validation library. You describe a schema by chaining
readable constraints (or with an equivalent config object); the first time you run
it, the whole tree is compiled into a single monomorphic function via
`new Function`. Chaining is build-time only — it compiles to the identical
validator — so the happy path allocates nothing, and rich constraints (`maxLines`,
`charset`, `blockWords`, formats, ranges) compile to inline code instead of
closures. Every schema is a [Standard Schema](https://standardschema.dev) and
exports JSON Schema.

```ts
import { t } from '@myrialabs/typkit';

const Comment = t.object({
  author: t.string().minLength(3).maxLength(20).charset('a-z0-9_'),
  email: t.string().email(),
  body: t.string().nonEmpty().maxLines(500).blockWords(BANNED),
  rating: t.int().min(1).max(5),
  tags: t.string().array().optional(),
  visibility: t.enum(['public', 'private']),
});

Comment.check(value);                  // boolean — zero-allocation hot path
Comment.assert(value);                 // throws on failure, returns typed value
Comment.parse(value);                  // { value } | { issues }
Comment['~standard'].validate(value);  // Standard Schema — Elysia, Hono, tRPC
Comment.toJsonSchema();                // OpenAPI / JSON Schema
type Comment = t.infer<typeof Comment>;
```

```sh
bun add @myrialabs/typkit      # or: npm install @myrialabs/typkit
```

## Why TypKit

- **Rich constraints that stay fast.** `maxLines`, `charset`, `blockWords`,
  `allowedWords`, and inline format checks (email, uuid, ipv4, Luhn `creditCard`, …)
  compile to literal loops. Competitors fall back to `.refine()/.check()/.narrow()`
  closures — **2.3–3.2× slower** — and TypeBox can't express them at all.
- **Zero-allocation hot path.** `check()` returns a boolean; a validated value is
  never wrapped in a new object, and an issue path is built only when something
  fails. It sits in the compiled fast tier with ArkType and TypeBox, and runs
  **8–90× faster than Zod, Valibot, and effect/Schema** — see [`bench-results.md`](./bench-results.md).
- **Works everywhere, no adapter.** Standard Schema means Elysia, Hono, tRPC,
  react-hook-form, and TanStack Form accept a schema directly.
- **JSON Schema in, OpenAPI out.** `toJsonSchema()` maps 1:1 from the config object,
  so frameworks generate OpenAPI / Swagger straight from your validation schema.
- **Honest type inference.** `t.infer<>` is full and precise, and stays light on
  `tsc` (about a quarter of ArkType's instantiations).
- **Self-documenting fluent API.** Chain readable constraints —
  `t.int().min(1).max(5)` — with no cryptic `gte`/`lt`: `min`/`max` are inclusive,
  `greaterThan`/`lessThan` exclusive. Chaining is build-time only, so it compiles to
  the same validator as the equivalent config object and costs nothing at runtime.
- **Zero runtime dependencies.** Node 18+, Bun, and the browser.

## Documentation

- [Guide](./docs/guide.md) — from first schema to framework integration.
- [API reference](./docs/api.md) — every builder and method.
- [Constraints](./docs/constraints.md) — every inline rule and format.
- [Frameworks](./docs/frameworks.md) — Elysia, Hono, tRPC, forms.
- [JSON Schema](./docs/json-schema.md) — OpenAPI / Swagger export.
- [Comparison](./docs/comparison.md) — TypKit vs Zod, ArkType, TypeBox, Valibot.
- [Benchmarks](./bench-results.md) — reproducible numbers.

## License

MIT © Myria Labs
