/**
 * Every schema exports JSON Schema via `toJsonSchema()`. Frameworks read this to
 * generate OpenAPI / Swagger documents straight from your validation schema.
 *
 *   bun run examples/json-schema.ts
 */
import { t } from '@myrialabs/typkit';

const User = t.object({
	id: t.int().min(1),
	name: t.string().minLength(2).maxLength(40),
	email: t.string().email(),
	role: t.enum(['admin', 'user']).default('user'),
	bio: t.string().maxLength(280).optional(),
	scores: t.number().min(0).max(100).array().minItems(1),
});

console.log(JSON.stringify(User.toJsonSchema(), null, 2));
