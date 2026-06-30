# Constraints Reference

Every built-in constraint compiles to **inline code** — literal comparisons and
loops, never a closure. That is what keeps rich rules fast: the rules below are
the differentiator other validators express through `.refine()/.check()/.narrow()`
(which can't be inlined) or can't express at all.

Every constraint below is available as a **chain method** (recommended) and as a
**config-object** key — both compile to the identical validator. The examples use
the chain form.

Bounds convention: `min` / `max` are **inclusive**; `greaterThan` / `lessThan`
are **exclusive**.

## Strings

`t.string({ ... })` accepts:

| Option | Type | Meaning |
|---|---|---|
| `minLength` / `maxLength` | `number` | length bounds (inclusive) |
| `length` | `number` | exact length |
| `nonEmpty` | `boolean` | reject `''` |
| `pattern` | `RegExp` | must match |
| `charset` | `string` | character class body, e.g. `'a-z0-9_'` (compiles to `^[...]*$`) |
| `startsWith` / `endsWith` / `includes` | `string` | substring rules |
| `maxLines` | `number` | at most N lines — inline newline scan, zero allocation |
| `blockWords` | `string[]` | reject if any blocked word appears (case-insensitive) |
| `allowedWords` | `string[]` | every whitespace token must be allowed |
| `trim` | `boolean` | reject leading/trailing whitespace (does not mutate) |
| `format` | `FormatName` | a named format (below) |

```ts
t.string().minLength(3).maxLength(20).charset('a-z0-9_'); // a username
t.string().nonEmpty().maxLines(500).blockWords(BANNED);   // a comment body
```

## Formats

`format` (or a shortcut like `t.email()`) selects a precompiled validator:

| Format | Backed by |
|---|---|
| `email`, `uuid`, `url`, `slug` | regex (also `t.email()` / `t.uuid()` / `t.url()` / `t.slug()`) |
| `ipv4`, `ipv6`, `ip` | regex |
| `datetime`, `date`, `time` | regex (ISO 8601) |
| `base64`, `hex`, `semver`, `e164` | regex |
| `json` | inline `JSON.parse` in a guard |
| `creditCard` | inline Luhn checksum (no allocation) |

```ts
t.string().format('ipv4');
t.string().format('creditCard');
```

## Numbers

`t.number({ ... })` and `t.int({ ... })` accept:

| Option | Meaning |
|---|---|
| `min` / `max` | inclusive bounds |
| `greaterThan` / `lessThan` | exclusive bounds |
| `integer` | whole number (implied by `t.int`) |
| `multipleOf` | divisibility |
| `positive` / `negative` / `nonnegative` | sign |
| `finite` | reject `NaN`/`±Infinity` — **off by default** |
| `safeInt` | within `Number.isSafeInteger` |
| `port` | integer in 1–65535 |

> **Why `finite` defaults off:** JSON cannot carry `NaN` or `Infinity`, so for
> API-body validation the check is pure overhead — omitting it is what lets TypKit
> match or beat compiled validators on numeric arrays. Opt in with `{ finite: true }`
> for non-JSON sources.

```ts
t.int().min(1).max(5);        // a rating
t.number().greaterThan(0);     // strictly positive
t.number().multipleOf(0.01);   // currency
```

## Arrays

`t.array(element, { ... })`:

| Option | Meaning |
|---|---|
| `minItems` / `maxItems` | length bounds |
| `length` | exact length |
| `nonEmpty` | reject `[]` |
| `unique` | reject duplicates (by value via `Set`; best for primitives) |

```ts
t.string().array().minItems(1).unique();
```

## Custom rules

When no built-in fits, `x.refine(predicate, message?)` adds a closure — the
[slow path](./api.md#custom-refinement-escape-hatch). Prefer built-ins first.
