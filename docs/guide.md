# Guide

A tour of TypKit from first schema to framework integration.

## Install

```sh
bun add @myrialabs/typkit      # or: npm install @myrialabs/typkit / pnpm add @myrialabs/typkit
```

Zero runtime dependencies; runs on Node 18+, Bun, and the browser.

## Your first schema

Build a schema by chaining constraints onto a base type, then reuse it everywhere.

```ts
import { t } from '@myrialabs/typkit';

const User = t.object({
  name: t.string().minLength(2).maxLength(40),
  email: t.string().email(),
  age: t.int().min(0).max(120),
  tags: t.string().array().optional(),
});
```

The first time you validate, the whole tree is compiled into one monomorphic
function via `new Function`, then cached on the schema. Subsequent calls just run
that function.

### Two equivalent styles

Chaining happens at **build time** — `.min(0).max(120)` just accumulates options
onto the node, which the compiler then inlines. So the fluent style and the
config-object style below compile to the **byte-identical** validator and run at
exactly the same speed; pick whichever reads better.

```ts
t.int().min(0).max(120);     // fluent (recommended)
t.int({ min: 0, max: 120 }); // config object — identical result
```

Constraints that take no value are methods too: `.nonEmpty()`, `.positive()`,
`.integer()`, `.trim()`, and the format shortcuts `.email()` / `.uuid()` /
`.url()` / `.slug()`.

## Validate

Four ways to run a schema, for four situations:

```ts
User.check(value);   // boolean — the zero-allocation hot path
User.assert(value);  // returns the typed value, or throws TypkitError
User.parse(value);   // { value } on success, { issues } on failure
User.parse(value, { abortEarly: false }); // collect every issue
```

- Reach for `check` in hot loops and guards — it allocates nothing on success.
- Reach for `assert` when a failure is exceptional and you want the typed value.
- Reach for `parse` when you want to branch on the result without `try/catch`.

## Infer the type

```ts
type User = t.infer<typeof User>;
// { name: string; email: string; age: number; tags?: string[] }
```

Optional properties become `?` properties; unions, discriminated unions, tuples,
and records all infer precisely. There is no separate "input vs output" type to
juggle for plain schemas.

## Compose

Everything nests. Objects have an algebra:

```ts
const Base = t.object({ id: t.int(), name: t.string() });
Base.partial();          // all properties optional
Base.pick(['id']);       // subset
Base.omit(['name']);     // complement
Base.extend({ age: t.int() });
Base.strict();           // reject unknown keys
Base.passthrough();      // allow unknown keys
```

Modifiers are methods on every node:

```ts
t.string().optional();        // string | undefined (optional object key)
t.string().nullable();        // string | null
t.string().default('guest');  // fills in during parse/assert
t.string().array();           // string[]
```

## Recursive schemas

Use `t.lazy` to defer construction:

```ts
type Category = { name: string; children: Category[] };
const Category = t.lazy(() =>
  t.object({ name: t.string(), children: Category.array() }),
);
```

`lazy` compiles its target into a memoized helper function, so self-reference
terminates.

## Next

- [Constraints reference](./constraints.md) — every inline rule and format.
- [API reference](./api.md) — every builder and method.
- [Frameworks](./frameworks.md) — Elysia, Hono, tRPC, forms.
- [JSON Schema](./json-schema.md) — OpenAPI / Swagger export.
- [Comparison](./comparison.md) — how TypKit relates to Zod, ArkType, TypeBox.
