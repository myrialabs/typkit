# Comparison

How TypKit relates to other TypeScript validators. Numbers come from the shipped
benchmark — see [`../bench-results.md`](../bench-results.md) and reproduce with
`bun run bench`.

## At a glance

| | TypKit | Zod | ArkType | TypeBox | Valibot |
|---|---|---|---|---|---|
| Authoring | fluent chain or config object | method chain | type syntax (string) | `Type.*` builders | piped functions |
| Compiles validator | ✅ `new Function` | partial (v4) | ✅ | ✅ (via compiler) | ❌ |
| Zero-alloc hot path | ✅ | ❌ | ✅ | ✅ | ❌ |
| Inline rich constraints | ✅ | ❌ (refine) | ❌ (narrow) | ✗ can't express | ❌ (check) |
| Standard Schema | ✅ | ✅ | ✅ | ✅ | ✅ |
| JSON Schema export | ✅ | via add-on | ✅ | ✅ (native) | via add-on |
| Runtime dependencies | none | none | none | none | none |

## Where TypKit fits

TypKit is in the **compiled fast tier** with ArkType and TypeBox. Against those
two it wins as schemas gain structure and ties at the bare-primitive floor;
against Zod, Valibot, and effect/Schema it runs **8–90× faster** across the board.

The real differentiator is **rich inline constraints**. `maxLines`, `charset`,
`blockWords`, `allowedWords`, and the inline `creditCard` Luhn check compile to
literal loops. The others must drop to an uninlinable closure:

```ts
// TypKit — inline, ~130 ns. The chain compiles to literal loops.
t.string().nonEmpty().maxLines(500).blockWords(BANNED);

// Zod — looks similar, but each refinement is an uninlinable closure, ~3× slower
z.string().min(1)
  .refine((s) => s.split('\n').length <= 500)
  .refine((s) => !BANNED.some((w) => s.toLowerCase().includes(w)));
```

TypKit's chain is build-time sugar: `.maxLines(500)` records an option that the
compiler inlines. Zod's `.refine(...)` stores a closure that runs per-validation.
Same-looking code, very different hot path.

TypeBox cannot express `maxLines`/`blockWords` in its compiled check at all.

## Choosing

- **You want the fastest validation of structured, constraint-heavy payloads, with
  JSON Schema for OpenAPI and no build step** — TypKit.
- **You want types-as-schema with a string DSL** — ArkType.
- **You're all-in on TypeBox/JSON-Schema-first tooling** — TypeBox.
- **You have an existing Zod ecosystem and ergonomics matter most** — Zod.

All of these implement Standard Schema, so they interoperate at the framework
boundary — you can migrate incrementally.

## Honest caveats

- For bare primitives (a single `typeof`) every compiled validator sits on the
  same ~1 ns floor; TypKit ties, it doesn't "win" there.
- On Node, TypeBox's compiled validator is exceptional on shallow all-scalar
  objects; treat that category as a tie.
- `refine` closures are TypKit's slow path too — the speed story is about the
  built-in, inline-compiled constraints.
