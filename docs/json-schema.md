# JSON Schema

Every schema exports a JSON Schema fragment via `toJsonSchema()`. The config-object
API maps almost 1:1 onto JSON Schema, so the export is direct and round-trippable
for OpenAPI / Swagger generation.

```ts
import { t } from '@myrialabs/typkit';

const User = t.object({
  id: t.int().min(1),
  name: t.string().minLength(2).maxLength(40),
  email: t.string().email(),
  role: t.enum(['admin', 'user']).default('user'),
  bio: t.string().maxLength(280).optional(),
});

User.toJsonSchema();
```

produces:

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "name": { "type": "string", "minLength": 2, "maxLength": 40 },
    "email": { "type": "string", "format": "email" },
    "role": { "enum": ["admin", "user"], "default": "user" },
    "bio": { "type": "string", "maxLength": 280 }
  },
  "required": ["id", "name", "email"]
}
```

## Mapping

| TypKit | JSON Schema |
|---|---|
| `t.string({ minLength, maxLength })` | `{ type: 'string', minLength, maxLength }` |
| `t.string({ charset })` / `{ pattern }` | `{ pattern }` |
| `t.email()`, `t.uuid()`, `t.url()`, `format` | `{ format }` (`datetime` → `date-time`) |
| `t.number({ min, max })` | `{ minimum, maximum }` |
| `t.number({ greaterThan, lessThan })` | `{ exclusiveMinimum, exclusiveMaximum }` |
| `t.int()` | `{ type: 'integer' }` |
| `t.object({...})` | `{ type: 'object', properties, required }` |
| `t.array(el, { minItems })` | `{ type: 'array', items, minItems }` |
| `t.enum([...])` | `{ enum: [...] }` |
| `t.literal(v)` | `{ const: v }` |
| `t.union(...)` | `{ anyOf: [...] }` |
| `t.discriminatedUnion(k, [...])` | `{ oneOf: [...] }` |
| `t.intersection(a, b)` | `{ allOf: [a, b] }` |
| `t.optional(x)` | property omitted from `required` |
| `t.nullable(x)` | `{ anyOf: [x, { type: 'null' }] }` |
| `t.default(x, v)` | `{ ...x, default: v }` |
| `t.record(v)` | `{ type: 'object', additionalProperties: v }` |
| `.strict()` / `.passthrough()` | `additionalProperties: false` / `true` |

## Notes

- A few inline string constraints (`maxLines`, `blockWords`, `allowedWords`) have
  no JSON Schema equivalent and are validated only at runtime; they are omitted
  from the exported schema rather than approximated.
- `toJsonSchema()` is a method on every node, including nested ones, so you can
  export any sub-schema.
