# API Reference

Everything is reached through the `t` builder and the methods on a schema node.

```ts
import { t } from '@myrialabs/typkit';
```

## Two construction styles

Every constraint is available both as a **chain method** (recommended) and as a
**config-object** key. Chaining runs at build time and accumulates options onto
the node, so both forms compile to the byte-identical validator and run at the
same speed.

```ts
t.string().minLength(3).maxLength(20).charset('a-z0-9_'); // fluent
t.string({ minLength: 3, maxLength: 20, charset: 'a-z0-9_' }); // identical

t.int().min(1).max(5);     // fluent
t.int({ min: 1, max: 5 }); // identical
```

The chain-method name matches the option name exactly. Value-less options are
no-arg methods: `.nonEmpty()`, `.positive()`, `.integer()`, `.trim()`, `.unique()`,
and the format shortcuts `.email()` / `.uuid()` / `.url()` / `.slug()`.

## Schema methods

Every node returned by `t.*` exposes the same surface:

| Method | Returns | Notes |
|---|---|---|
| `check(value)` | `boolean` | Zero-allocation hot path. |
| `assert(value)` | `Out` | Throws `TypkitError` on failure; returns the typed (coerced) value. |
| `parse(value, options?)` | `{ value } \| { issues }` | `options.abortEarly` defaults to `true`. |
| `['~standard'].validate(value)` | `{ value } \| { issues }` | Standard Schema v1 entry point. |
| `toJsonSchema()` | `JsonSchema` | OpenAPI / JSON Schema fragment. |

`t.infer<typeof schema>` (or the exported `Infer<typeof schema>`) gives the
inferred output type.

```ts
type ParseOptions = { abortEarly?: boolean };
interface Issue { message: string; path: ReadonlyArray<PropertyKey>; }
```

## Scalars

| Builder | Output | Options |
|---|---|---|
| `t.string(opts?)` | `string` | [string constraints](./constraints.md#strings) |
| `t.number(opts?)` | `number` | [number constraints](./constraints.md#numbers) |
| `t.int(opts?)` | `number` | `number` with `integer: true` |
| `t.boolean()` | `boolean` | — |
| `t.bigint()` | `bigint` | — |
| `t.date()` | `Date` | rejects invalid `Date`s |
| `t.literal(value)` | the literal | string / number / boolean / null |
| `t.enum(values)` | union of values | `readonly (string \| number)[]` |
| `t.any()` / `t.unknown()` | `any` / `unknown` | no checks |
| `t.null()` / `t.undefined()` | `null` / `undefined` | — |

### Format shortcuts

`t.email()`, `t.uuid()`, `t.url()`, `t.slug()` are `t.string()` with a format
preset; each still accepts the other string options. The full format list
(`ipv4`, `datetime`, `creditCard`, …) is in the [constraints reference](./constraints.md#formats).

## Composites

| Builder | Output |
|---|---|
| `t.object(shape)` | object; `.partial/.pick/.omit/.extend/.strict/.passthrough` |
| `t.array(element, opts?)` | `T[]`; `minItems`/`maxItems`/`length`/`nonEmpty`/`unique` |
| `t.tuple(...items)` | fixed-length tuple |
| `t.record(value, keyPattern?)` | `Record<string, V>` |
| `t.union(...options)` | union of members |
| `t.discriminatedUnion(key, options)` | tagged union, O(1) dispatch |
| `t.intersection(a, b)` | `A & B` |

## Modifiers

Available both as chain methods on any node (recommended) and as `t.*` factories.

| Chain method | Factory | Output | Notes |
|---|---|---|---|
| `x.optional()` | `t.optional(x)` | `T \| undefined` | makes an object key optional |
| `x.nullable()` | `t.nullable(x)` | `T \| null` | |
| `x.default(value)` | `t.default(x, value)` | `T` | fills missing value during `parse`/`assert` |
| `x.array(opts?)` | `t.array(x, opts?)` | `T[]` | wrap as an array element |
| `x.refine(fn, msg?)` | `t.refine(x, fn, msg?)` | `T` | custom predicate (slow path) |
| — | `t.lazy(() => inner)` | `T` | recursive / deferred schemas |

## Coercion

For query/path params, where values arrive as strings. `check` stays boolean;
`parse`/`assert` return the coerced value.

| Builder | Output |
|---|---|
| `t.coerce.number(opts?)` | `number` (via `Number()`, then number constraints) |
| `t.coerce.boolean()` | `boolean` (`'true'`/`'false'`/`'1'`/`'0'`/`1`/`0`) |
| `t.coerce.date()` | `Date` (via `new Date()`) |

## Errors

`assert` throws `TypkitError`, which carries `issues: Issue[]`. `formatPath(path)`
renders a path as a `/a/b/0` pointer (or `<root>`).

## Custom refinement (escape hatch)

`x.refine(predicate, message?)` (or `t.refine(x, predicate, message?)`) adds a
custom predicate. It is the **slow path**: the closure cannot be inlined, so it
runs as a function call after the inner schema's built-in (inlined) checks pass.
Return `true` to accept, or `false` / a message `string` to reject.

```ts
const Even = t.int().refine((n) => n % 2 === 0, 'must be even');
const Handle = t.string().refine((s) => (s.startsWith('@') ? true : 'must start with @'));
```

Prefer the [built-in constraints](./constraints.md) — they compile inline and are
2–4× faster. Reach for `refine` only when no built-in expresses the rule.
