# Examples

Runnable examples for TypKit. With the repo cloned and `bun install` done:

```sh
bun run examples/basic.ts        # check / assert / parse / infer
bun run examples/coercion.ts     # query-param coercion (string → typed)
bun run examples/json-schema.ts  # toJsonSchema() output
bun run examples/elysia.ts       # Elysia (native Standard Schema) — starts a server
bun run examples/hono.ts         # Hono validator middleware
```

| File | Shows |
|---|---|
| [`basic.ts`](./basic.ts) | Building a schema and the `check` / `assert` / `parse` surface, plus `Infer`. |
| [`coercion.ts`](./coercion.ts) | `t.coerce.number/boolean/date` and `t.default` for query params. |
| [`json-schema.ts`](./json-schema.ts) | Exporting JSON Schema for OpenAPI / Swagger. |
| [`elysia.ts`](./elysia.ts) | Using a schema directly as an Elysia `body` / `query` validator. |
| [`hono.ts`](./hono.ts) | The `validator(target, schema)` middleware from `@myrialabs/typkit/middleware`. |
| [`trpc.ts`](./trpc.ts) | A TypKit schema as a tRPC input parser (needs `@trpc/server`). |

Every schema is a [Standard Schema](https://standardschema.dev), so the same
schemas also work with react-hook-form, TanStack Form, and anything else that
accepts one — no adapter required.
