# Frameworks

Every TypKit schema implements [Standard Schema](https://standardschema.dev), so
most frameworks accept one with **no adapter**. The `@myrialabs/typkit/middleware` entry
ships the few helpers where a thin adapter is still convenient.

## Elysia (native)

Pass a schema straight into a route's `body` / `query` / `params` / `response`.
Valid requests reach the handler; invalid ones return `422` with the issue path;
`t.coerce.*` query schemas decode string params automatically.

```ts
import { Elysia } from 'elysia';
import { t } from '@myrialabs/typkit';

new Elysia()
  .post('/users', ({ body }) => body, {
    body: t.object({ name: t.string().minLength(2), age: t.int().min(0) }),
  })
  .get('/search', ({ query }) => query, {
    query: t.object({ page: t.coerce.number({ min: 1 }) }),
  });
```

For explicit validation inside a handler (e.g. a `derive`), use `validate`:

```ts
import { validate } from '@myrialabs/typkit/middleware';
const user = validate(UserSchema, payload); // typed, or throws → 422
```

## Hono

Hono needs a small validator middleware. The validated, coerced value is exposed
via `c.req.valid(target)`; failures return `400` with the issues.

```ts
import { Hono } from 'hono';
import { t } from '@myrialabs/typkit';
import { validator } from '@myrialabs/typkit/middleware';

const app = new Hono().post(
  '/users',
  validator('json', t.object({ name: t.string().minLength(2) })),
  (c) => c.json(c.req.valid('json')),
);
```

`target` is one of `'json' | 'form' | 'query' | 'param' | 'header' | 'cookie'`.
Since TypKit schemas are Standard Schemas, `@hono/standard-validator` works too;
this adapter ships in-package so no extra dependency is required.

## tRPC

tRPC v11 accepts any Standard Schema as an input/output parser:

```ts
import { initTRPC } from '@trpc/server';
import { t as k } from '@myrialabs/typkit';

const t = initTRPC.create();
export const appRouter = t.router({
  createUser: t.procedure
    .input(k.object({ name: k.string().minLength(2), age: k.int().min(0) }))
    .mutation(({ input }) => input), // `input` is fully typed
});
```

## Forms

react-hook-form (`@hookform/resolvers/standard-schema`) and TanStack Form accept
Standard Schemas directly:

```ts
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { t } from '@myrialabs/typkit';

const schema = t.object({ email: t.string().email(), password: t.string().minLength(8) });
useForm({ resolver: standardSchemaResolver(schema) });
```

## OpenAPI / Swagger

Use [`toJsonSchema()`](./json-schema.md) to feed OpenAPI generators — Elysia's
OpenAPI plugin reads it automatically from the route schema.
